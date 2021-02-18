const mongoose = require("mongoose");
const Player = require("./player");
const Schema = mongoose.Schema;

const LobbySchema = new Schema ({
    lobbyCode: Number,
    scoreLimit: Number,
    gameStarted: Boolean,
    single: String,
    restarts: Number,
    disconnects: Number,
    playerList: [String],
    handsInPlay: {
        type:Array,
        "default": []
    },
    players: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Player'
        }
    ]
});

LobbySchema.post('findOneAndDelete', async function (doc) {
    if (doc) {
        await Player.deleteMany({
            _id: {
                $in: doc.players
            }
        })
    }
});

module.exports = mongoose.model("Lobby",LobbySchema);