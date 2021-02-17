const masterDeck = require("../cards.json");
const Player = require("../models/player.js");
const Lobby = require("../models/lobby.js");
var lobbyList = {};

module.exports.index = async (req, res) => {
    res.render("index")
}

module.exports.game = async (req, res) => {
    const lobbyCode = req.query.lobbycode;
    const username = req.query.username;

    const host = await Lobby.findOne({ lobbyCode: lobbyCode}).populate({path: "players", match: {isHost: true}, select: 'username -_id'});
    console.log("host is: " + host.players[0].username);

    if(host) {
        if (username == host) {
            res.render("gameHost", { username: req.query.username, lobbycode: req.query.lobbycode });
        }
        else {
            res.render("game", { username: req.query.username, lobbycode: req.query.lobbycode });
        }
    }
    else {
        res.redirect("/");
    }
}

module.exports.join = async (req, res) => {
    var ip = req.header('x-forwarded-for') || req.socket.remoteAddress;
    var username = req.body.username.trim().toLowerCase();
    var lobbyCode = req.body.lobbyCode;

    console.log(username, " is joining game: " + lobbyCode);

    var lobby = await Lobby.findOne({lobbyCode: lobbyCode});

    if (lobby) {
        var existingPlayer = await Lobby.findOne({lobbyCode: lobbyCode}).populate({path: "players", match: {username: username}});
        if (existingPlayer.players.length === 0) {
            
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

    // var userDoesExist = checkUserExists(username);
    // var gameStarted = lobbyList[lobbyCode].gameStarted;

    // if (!userDoesExist && lobbyExists && !gameStarted) {
    //     await createPlayer(username, ip, false);
    //     addToLobby(username, lobbyCode);
    //     res.redirect("/game?username=" + username + "&lobbycode=" + lobbyCode);
    // }
    // else if (!lobbyExists) {
    //     res.redirect("/");
    // }
    // else if (gameStarted) {
    //     res.redirect("/");
    // }
    // else {
    //     res.redirect("/");
    //}
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

async function createPlayer(username, ip, isHost) {
    const player = new Player();
    player.username = username;
    player.ip = ip;
    player.isHost = isHost;

    await player.save();
};

async function checkUserExists(username) {
    console.log("Checking user exists");
    const player = await Player.find({ username: username });
    if (player.length == 0) {
        console.log("That player cannot be found");
        return false;
    }
    else {
        console.log("Duplicate player found")
        return true;
    }
}

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
}

async function checkLobbyExists(lobbycode) {
    var response = false;
    console.log(Object.keys(lobbyList))
    for (let i = 0; i < Object.keys(lobbyList).length; i++) {
        if (lobbyList[lobbycode]) {
            response = true;
        }
    }
    return response;
}

function addToLobby(username, lobbyCode) {
    if (lobbyList[lobbyCode]) {
        lobbyList[lobbyCode].players.push(username);
        lobbyList[lobbyCode].hands[username] = [];
        console.log("Current Lobby = " + lobbyList[lobbyCode].players);
    }
    else {
        console.log("Lobby does not exitst");
    }
};

async function generateLobbyCode() {
    var code = Math.floor(100000 + Math.random() * 900000);
    return code;
};