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
    .get(async (req, res) => {
        const session = docStore.openSession();

        const result = await session.query({
            indexName: 'TodoItemsIndex',
        })
        .orderByDescending('createdAt')
        .waitForNonStaleResults()
        .all();

        res.status(200);
        res.type("application/json");
        res.send(JSON.stringify(result));
    })
    .post(async (req, res) => {
        const { content } = req.body;
        const session = docStore.openSession();
        const item = {
            content: content,
            createdAt: new Date(),
            isChecked: false
        };

        await session.store(item, null, "TodoItems");
        await session.saveChanges();

        res.status(200)
            .type("application/json")
            .send(JSON.stringify(item));
    })
    .put(async (req, res) => {
        const { id, isChecked } = req.body;
        const session = docStore.openSession();
        
        const doc = await session.load(id)
        if (!doc) {
            res.sendStatus(404);
        }
                
        doc.isChecked = isChecked;
        await session.saveChanges();
        res.sendStatus(200);
    })
    .delete(async (req, res) => {
        const { id } = req.body;
        let session = docStore.openSession();
        await session.delete(id);
        await session.saveChanges();
        res.sendStatus(200);
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
}


setupDatabase();
app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});

