const express = require('express')
const app = express()
const cors = require('cors')
const port = 3000
const axios = require('axios')
const sqlite3 = require('sqlite3');
const { createHash } = require('crypto');
const queryString = require('querystring')
const path = require('path');
const multer = require('multer');
const upload = multer();
const uuid = require('uuid');

const db = new sqlite3.Database(path.join(__dirname, 'mydatabase.db'));

db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, token INTEGER)');
    db.run('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT, amount INTEGER)');
});

function hash(string) {
    return createHash('sha256').update(string).digest('hex');
}

const secret_1 = '9625013ebd229d41c756b841c8a13951'
const secret_2 = 'eb76e9e6a4a5ea013c7e7adfb8b3771b'
const shop_id = '71c63778-f523-44e3-bf32-afa87a00ad55'


app.use(cors())
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }))


app.post('/generateImage', (req, res) => {
    const url = 'http://62.68.146.39:4000/gen/createNude';
    const data = {
        "mask": req.body.mask
    };
    axios.post(url, data)
        .then(response => {
            res.send(response.data)
        })
        .catch(error => {
            res.send('error')
        });
})

app.get('/me/:userID', (req, res) => {
    const userId = req.params.userID;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (!row) {
            db.run('INSERT INTO users (id, token) VALUES (?, ?)', [userId, 0], function (err) {
                if (err) {
                    return console.error(err.message);
                }
                console.log(`A row has been inserted with rowid ${this.lastID}`);
            });

            res.status(200).json({
                id: userId,
                token: 0
            });

            return;
        }

        res.json(row);
    });

})

app.post('/success', upload.none(), async (req, res) => {
    const data = req.body;
    let userID;
    let amount
    db.get('SELECT * FROM orders WHERE id = ?', [data.order_id], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (!row) {
            return;
        }

        userID = row.user_id;
        amount = row.amount;
        db.run('UPDATE users SET token = token + ? WHERE id = ?', [amount, userID], function (err) {
            if (err) {
                return console.error(err.message);
            }
        });

    });

    res.send('success')
})

app.post('/minus', (req, res) => {
    const data = req.body;
    db.run('UPDATE users SET token = token - ? WHERE id = ?', [data.token, data.userID], function (err) {
        if (err) {
            return console.error(err.message);
        }
    });
    res.send('success')
})

app.post('/payment', (req, res) => {
    const data = req.body;
    const order_id = uuid.v4();
    const amount = data.amount;
    const userID = data.userID;
    const token = data.token;

    const stringsArray = [shop_id, amount, "RUB", secret_1, order_id];
    const joinedString = stringsArray.join(':');

    db.run('INSERT INTO orders (id, user_id, amount) VALUES (?, ?, ?)', [order_id, userID, token], function (err) {
        if (err) {
            return console.error(err.message);
        }
        console.log(`A row has been inserted with rowid ${this.lastID}`);
    });

    const params = {
        merchant_id: shop_id,
        amount: amount,
        currency: 'RUB',
        order_id: order_id,
        sign: hash(joinedString),
    };

    const paymentUrl = 'https://aaio.io/merchant/pay?' + queryString.stringify(params);
    res.json(paymentUrl);
    //res.redirect(paymentUrl)

})
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})