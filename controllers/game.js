const masterDeck = require("../cards.json");
var playerList = [];
var lobbyList = {};

module.exports.index = async (req,res) => {
    res.render("index")
}

module.exports.game = async (req,res) => {
  if(lobbyList[req.query.lobbycode]){
    if(lobbyList[req.query.lobbycode].players.includes(req.query.username)){
      if(checkIsUserHost(req.query.username)  == true){
        res.render("gameHost", {username: req.query.username, lobbycode: req.query.lobbycode});
      }
      else{
        res.render("game", {username: req.query.username, lobbycode: req.query.lobbycode});
      };
    }
    else{
      res.redirect("/");
    }
  }
  else {
    res.redirect("/");
  }
}

module.exports.join = async (req,res) => {
  var ip = req.header('x-forwarded-for') || req.socket.remoteAddress;
  var username = req.body.username.trim().toLowerCase();
  var gameCode = req.body.gameCode;

  console.log(username, " is joining game: " + gameCode);

  var lobbyExists = checkLobbyExists(gameCode);
  var userDoesExist = checkUserExists(username);
  var gameStarted = lobbyList[gameCode].gameStarted;

  if (!userDoesExist && lobbyExists && !gameStarted) {
    createPlayer(username, ip, false);
    addToLobby(username,gameCode);
    res.redirect("/game?username=" + username + "&lobbycode=" + gameCode);
  }
  else if(!lobbyExists){
    res.redirect("/");
  }
  else if(gameStarted){
    res.redirect("/");
  }
  else {
    res.redirect("/");
  };
}

module.exports.create = async (req,res) => {
  var ip = req.header('x-forwarded-for') || req.socket.remoteAddress;
  var username = req.body.username.toLowerCase();

  var doesExist = checkUserExists(username);
  if (doesExist) {
    res.redirect("/");
  }
  else {
    createPlayer(username, ip, true);
    createLobby(username, ip, function(code) {
      res.redirect("/game?username=" + username + "&lobbycode=" + code);
    });
  }

}

module.exports.cards = async (req,res) => {
  var cards = masterDeck;
  res.render("cardview", {cards:cards})
}


function checkUserExists(username) {
    console.log("Checking user exists");
    var response = false;
    for (var i = 0; i < playerList.length; i++) {
      console.log(playerList[i].username);
      console.log(username);
      if (playerList[i].username === username) {
        response = true;
        console.log("playerlist: " + playerList)
      }
    }
    console.log("playerList " + playerList)
    console.log("Response " + response)
    return response
  }
  
  function checkLobbyExists(lobbycode) {
    var response= false;
    console.log(Object.keys(lobbyList))
    for(let i = 0 ; i < Object.keys(lobbyList).length; i++) {
      if(lobbyList[lobbycode]){
        response = true;
      }
    }
    return response;
  }
  
  function createPlayer(username, ip, isHost) {
    var player = {
      username: username,
      ip: ip,
      isHost: isHost
    }
    playerList.push(player)
    console.log("Playerlist = " + playerList)
  }
  
  //Create a lobby object with given username and ip and store it in the database
  function createLobby(username, ip, callback) {
    //Create a new lobby
    generateLobbyCode(function(code) {
  
      var newLobby = {
          ServerName: username + "'s lobby",
          players: [username],
          hands: {},
          handsInPlay : {},
          gameStarted : false,
          disconnects: 0,
          restarts: 0
      }
      newLobby.hands[username] = [];
      lobbyList[code] = newLobby;
  
      console.log(lobbyList[code])
      callback(code);
    })
  };
  
  function addToLobby(username,gameCode) {
    if (lobbyList[gameCode]) {
      lobbyList[gameCode].players.push(username);
      lobbyList[gameCode].hands[username] = [];
      console.log("Current Lobby = " + lobbyList[gameCode].players);
    }
    else {
      console.log("Lobby does not exitst");
    }
  };
  
  function generateLobbyCode(callback) {
    var code = Math.floor(100000 + Math.random() * 900000);
    callback(code);
  };

  function checkIsUserHost(username) {
    var response = false;
    for (var i = 0; i < playerList.length; i++) {
      if (playerList[i].username === username){
        if ((playerList[i]).isHost == true) {
            response = true;
        }
      }
    }
    return response;
  };