const path = require('path');
const { DocumentStore } = require('ravendb');
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
    .get(async (req, res, next) => {
        let result;

        try {
            const session = docStore.openSession();
            result = await session.query({
                documentType: 'TodoItems',
            })
            .orderByDescending('createdAt')
            .waitForNonStaleResults()
            .all();
        } catch (err) {
            next(err);
        }

        res.status(200);
        res.type("application/json");
        res.send(JSON.stringify(result));
    })
    .post(async (req, res, next) => {
        const { content } = req.body;
        const session = docStore.openSession();
        const item = {
            content: content,
            createdAt: new Date(),
            isChecked: false
        };

        try {
            await session.store(item, null, "TodoItems");
            await session.saveChanges();
        } catch (err) {
            next(err);
        }

        res.status(200)
            .type("application/json")
            .send(JSON.stringify(item));
    })
    .put(async (req, res, next) => {
        const { id, isChecked } = req.body;
        const session = docStore.openSession();

        try {
            const doc = await session.load(id)
            if (!doc) {
                res.sendStatus(404);
                return;
            }

            doc.isChecked = isChecked;
            await session.saveChanges();
        } catch (err) {
            next(err);
        }

        res.sendStatus(200);
    })
    .delete(async (req, res, next) => {
        const { id } = req.body;
        let session = docStore.openSession();
        try {
            await session.delete(id);
            await session.saveChanges();
        } catch (err) {
            next(err);
        }

        res.sendStatus(200);
    });

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});

