const path = require('path');
const VError = require('verror');
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
    .get(function (req, res) {
        const session = docStore.openSession();

        session.query({
            indexName: 'TodoItemsIndex',
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
            res.status(500);
            res.send(reason);
        });
    })
    .post(function (req, res) {
        const { content } = req.body;
        const session = docStore.openSession();
        const item = {
            content: content,
            createdAt: new Date(),
            isChecked: false
        };
        session.store(item, null, "TodoItems")
        .then(() => session.saveChanges())
        .then(() => { 
            res.status(200);
            res.type("application/json");
            res.send(JSON.stringify(item));
        });
    })
    .put(function (req, res) {
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

                res.status(500);
                res.send(err);
            });
    })
    .delete(function (req, res) {
        const { id } = req.body;
        const session = docStore.openSession();
        session.delete(id)
        .then(() => session.saveChanges())
        .then(() => res.sendStatus(200))
        .catch(err => { 
            res.status(500);
            res.send(err);
        });
    });

const indexes = [
    new IndexDefinition(
        "TodoItemsIndex",
        `from item 
     in docs.TodoItems 
     select new { 
         createdAt = item.createdAt, 
         isChecked = item.isChecked
     }`)
];

function setupDatabase() {
    const putIndexes = new PutIndexesOperation(indexes);
    docStore.admin.send(putIndexes);
    return Promise.resolve();
}

setupDatabase().then(() => {
    app.listen(3000, function () {
        console.log('Example app listening on port 3000!');
    });
});

