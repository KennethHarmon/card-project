const mongoose = require('mongoose');
const Schema =  mongoose.Schema;

const PlayerSchema = new Schema({
    username:  String,
    ip: String,
    isHost:  Boolean,
    socketid: String,
    hand: {
        type:Array,
        "default": []
    }
});

module.exports = mongoose.model("Player",PlayerSchema);