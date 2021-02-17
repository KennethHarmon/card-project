const mongoose = require('mongoose');
const Schema =  mongoose.Schema;

const PlayerSchema = new Schema({
    username:  String,
    ip: String,
    isHost:  Boolean
});

module.exports = mongoose.model("Player",PlayerSchema);