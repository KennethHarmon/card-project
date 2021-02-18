const masterDeck = require("../cards.json");
const Player = require("../models/player.js");
const Lobby = require("../models/lobby.js");

module.exports.index = async (req, res) => {
    res.render("index")
}

module.exports.game = async (req, res) => {
    const lobbyCode = req.query.lobbycode;
    const username = req.query.username;

    const host = await Lobby.findOne({ lobbyCode: lobbyCode}).populate({path: "players", match: {isHost: true}, select: 'username -_id'});

    if(host) {
        if (username === host.players[0].username) {
            console.log(username + " is the host");
            res.render("gameHost", { username: req.query.username, lobbycode: req.query.lobbycode });
        }
        else {
            console.log(username + " is a player");
            res.render("game", { username: req.query.username, lobbycode: req.query.lobbycode });
        }
    }
    else {
        res.redirect("/");
    }
}

module.exports.join = async (req, res) => {
    const ip = req.header('x-forwarded-for') || req.socket.remoteAddress;
    const username = req.body.username.trim().toLowerCase();
    const lobbyCode = req.body.lobbyCode;
    const lobby = await Lobby.findOne({lobbyCode: lobbyCode});

    console.log(username, " is joining game: " + lobbyCode);

    if (lobby) {
        var existingPlayer = await Lobby.findOne({lobbyCode: lobbyCode}).populate({path: "players", match: {username: username}});
        if (existingPlayer.players.length === 0) {
            var player = new  Player();
            player.username = username;
            player.ip = ip;
            player.isHost = false;
            lobby.players.push(player);
            await player.save();
            await lobby.save();
            res.redirect("/game?username=" + username + "&lobbycode=" + lobbyCode);
        }
        else {
            //Player already existed
            console.log("Username already taken in lobby");
            res.redirect("/");
        }
    }
    else {
        // Lobby doesn't exit
        res.redirect("/");
    }
};

module.exports.create = async (req, res) => {
    var ip = req.header('x-forwarded-for') || req.socket.remoteAddress;
    var username = req.body.username.toLowerCase();

    var code = await createLobby(username,ip);
    res.redirect("/game?username=" + username + "&lobbycode=" + code);
};

module.exports.cards = async (req, res) => {
    var cards = masterDeck;
    res.render("cardview", { cards: cards })
};

///////////////////////////////////////////////////////// ASYNC FUNCTIONS /////////////////////////////////

async function createLobby(username, ip) {
    const lobby = new Lobby();
    var code = await generateLobbyCode();
    lobby.lobbyCode = code;
    const host = new Player();
    host.username = username;
    host.ip = ip;
    host.isHost = true;
    lobby.players.push(host);
    await host.save();
    await lobby.save();
    return code;
};

async function generateLobbyCode() {
    var code = Math.floor(100000 + Math.random() * 900000);
    return code;
};