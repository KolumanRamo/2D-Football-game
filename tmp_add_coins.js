require('dotenv').config();
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: String,
    coins: Number
});

const User = mongoose.model('User', userSchema);

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected to DB');
        const users = await User.find({});
        for (let user of users) {
            user.coins += 999999;
            await user.save();
            console.log(`${user.username} adlı kurucuya 999.999 jeton eklendi!`);
        }
        if (users.length === 0) console.log("Veritabanında henüz kullanıcı yok.");
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
