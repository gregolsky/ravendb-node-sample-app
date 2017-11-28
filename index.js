const path = require('path');
const { DocumentStore, PutIndexesOperation, IndexDefinition } = require('ravendb');
const express = require('express');
const bodyParser = require('body-parser');

const settings = require('./settings.json');

const docStore = DocumentStore.create(settings.ravendb.url, settings.ravendb.database);
docStore.initialize();

const app = express()
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.route('/api/items')
    .get(function (req, res, next) {
        const session = docStore.openSession();

        session.query({
            collection: 'TodoItems'
        })
        .orderByDescending('createdAt')
        .waitForNonStaleResults()
        .all()
        .then(result => {
            res.status(200);
            res.type("application/json");
            res.send(JSON.stringify(result));
        })
        .catch(reason => {
            next(reason);
        });
    })
    .post(function (req, res, next) {
        const { content } = req.body;
        const session = docStore.openSession();
        const item = {
            content: content,
            createdAt: new Date(),
            isChecked: false
        };
        session.store(item, null, { documentType: "TodoItem" })
        .then(() => session.saveChanges())
        .then(() => { 
            res.status(200);
            res.type("application/json");
            res.send(JSON.stringify(item));
        });
    })
    .put(function (req, res, next) {
        const { id, isChecked } = req.body;
        const session = docStore.openSession();
        session.load(id)
            .then(doc => {
                if (!doc) {
                    throw new VError({
                        name: "ItemNotFound",
                        info: {
                            id
                        }
                    });
                }
                
                doc.isChecked = isChecked;
                return session.saveChanges();
            })
            .then(() => res.sendStatus(200))
            .catch(err => {
                if (err && err.name === "ItemNotFound") {
                    res.sendStatus(404);
                    return;
                }

                next(err);
            });
    })
    .delete(function (req, res, next) {
        const { id } = req.body;
        const session = docStore.openSession();
        session.delete(id)
        .then(() => session.saveChanges())
        .then(() => res.sendStatus(200))
        .catch(err => { 
            next(err)
        });
    });

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});

