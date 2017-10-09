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

app.get('/api/items', function (req, res) {
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
        res.send(JSON.stringify(result, null, 2));
    })
    .catch(reason => {
        res.status(500);
        res.send(reason);
    });
});
     //"url": "http://4.live-test.ravendb.net",
app.post('/api/items', function (req, res) {
    const { content } = req.body;
    const session = docStore.openSession();
    session.store({
        content: content,
        createdAt: new Date(),
        isChecked: false
    }, null, "TodoItems")
    .then(() => session.saveChanges())
    .then(() => res.sendStatus(200));
});

app.delete('/api/items', function (req, res) {
    const { id } = req.body;
    const session = docStore.openSession();
    session.delete(id)
        .then(() => session.saveChanges())
        .then(() => res.sendStatus(200));
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

