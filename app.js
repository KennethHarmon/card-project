///////////////////////////REQUIRES/////////////////////////////////

var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var bodyParser = require("body-parser");
const maindeck = require("./cards.json")

app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static("public"));
app.set("view engine", "ejs");

///////////////////////////////////////////Server Variables/////////////////////////////////////
var playerList = [];
var lobbyList = {};

var masterDeck = maindeck;

////////////////////////////////////////////PAGE ROUTES////////////////////////////////////////

//Serve index page
app.get('/', function(req, res){
  //var randomCards = getRandomCards(2,1);
  //console.log("randomCards: " + randomCards)
  res.render("index")
});

//Serve game page
app.get("/game", function(req,res) {
  console.log("Game get request");
  console.log(req.query)
  if(lobbyList[req.query.lobbycode]){
    console.log("LOBBY EXISTS");
    if(lobbyList[req.query.lobbycode].players.includes(req.query.username)){
      console.log("and player is included");
      console.log(lobbyList[req.query.lobbycode].players);
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
})

//Join Game
app.post("/game/join", function(req,res) {
  var ip = req.header('x-forwarded-for') || req.socket.remoteAddress;
  var username = req.body.username.trim().toLowerCase();
  var gameCode = req.body.gameCode;

  console.log(username, " is joining game: " + gameCode);

  var lobbyExists = checkLobbyExists(gameCode);
  var userDoesExist = checkUserExists(username);
  var gameStarted = lobbyList[gameCode].gameStarted;

  if (!userDoesExist && lobbyExists && !gameStarted) {
    console.log("No user exists");
    console.log("Lobby does exist");
    createPlayer(username, ip, false);
    addToLobby(username,gameCode);
    res.redirect("/game?username=" + username + "&lobbycode=" + gameCode);
  }
  else if(!lobbyExists){
    console.log("Lobby doesnt exist. Can't add user");
    res.redirect("/");
  }
  else if(gameStarted){
    console.log("Game Started, can't join.");
    res.redirect("/");
  }
  else {
    console.log("User already exists, can't join lobby");
    res.redirect("/");
  };
});

//Create a new game
app.post('/game/new', function(req, res){
  var ip = req.header('x-forwarded-for') || req.socket.remoteAddress;
  var username = req.body.username.toLowerCase();

  var doesExist = checkUserExists(username);
  if (doesExist) {
    console.log("User already exists, can't create lobby")
    res.redirect("/");
  }
  else {
    console.log("No user exists")
    createPlayer(username, ip, true);
    createLobby(username, ip, function(code) {
      console.log("Code: " + code)
      res.redirect("/game?username=" + username + "&lobbycode=" + code);
    });
  }
});

//Serve cards page
app.get('/cards', function(req, res){
  var cards = masterDeck;
  res.render("cardview", {cards:cards})
});

////////////////////////////////////////////////SOCKET.IO SECTION/////////////////////////////////////////

//Once a socket has connected
io.on('connection', function (socket) {
  console.log("user has connected: " + socket.id);
  
  socket.on("newUser", function(data) {
    //Setup players socket variabless
    socket.username = data.username;
    socket.lobbycode = data.lobbycode;

    if(lobbyList[socket.lobbycode]){
        //Add the player to the room only if they're listed in the players for that room
      if (lobbyList[socket.lobbycode].players.includes(socket.username)){

        //Add Id to lobbyList under players username
        lobbyList[socket.lobbycode][socket.username] = socket.id;
        console.log("Adding: " + socket.username + " to: " + socket.lobbycode);
        socket.join(socket.lobbycode);
        io.to(socket.lobbycode).emit("connectedRoom", { room: data.room, players: lobbyList[socket.lobbycode].players,username:socket.username});
      }
    }
    else {
      console.log("User has been disconnected");
      io.to(socket.username).emit("chat message", {sender: "GAME", msg: "Error, user disconnected, please return to the homepage and rejoin"})
    }

    console.log("Socket ID :" + socket.id);
    console.log("Socket Username: " + socket.username);
    console.log("Socket LobbyCode: " + socket.lobbycode);
  });

  socket.on("Start game", (scoreLimit) => {
    if(lobbyList[socket.lobbycode]){
      console.log("Game started in room: " + socket.lobbycode + " by " + socket.username)
      lobbyList[socket.lobbycode].scoreLimit = scoreLimit;
      lobbyList[socket.lobbycode].gameStarted = true;
      setupDecks(socket,4,3);
      chooseRandomSingle(socket);
      io.to(socket.lobbycode).emit("scorelimit",scoreLimit);
      io.to(socket.lobbycode).emit("game started");
    }
    else{
      io.to(socket.lobbycode).emit("chat message", {sender: "GAME", msg: "Error, lobby no longer exists, please make a new game from the <a href='/'>homepage</a>"})
    }
  });

  socket.on("send hand", function(data) {
    let username = socket.username;
    let lobbycode = socket.lobbycode;
    let currentPlayersHand = lobbyList[lobbycode].hands[username]

    console.log("Hand recieved: " + data.selectedcards)
    console.log("PLayers: 122421 " + JSON.stringify(lobbyList[lobbycode].players));

    var tempPlayerList = [];
      lobbyList[lobbycode].players.forEach(element => {
      tempPlayerList.push(element);
    }); 
    console.log("Temp player List: " + JSON.stringify(tempPlayerList));

    var singleIndex = tempPlayerList.indexOf(lobbyList[lobbycode].single);
    tempPlayerList.splice(singleIndex, 1);

    //Remove matching cards from the players hands
    for(let i = 0; i < currentPlayersHand.length; i++) {
      if(data.selectedcards[0].text === currentPlayersHand[i].text){
        lobbyList[lobbycode].hands[username].splice(i, 1);
      };
      
      if(data.selectedcards[1]){
        if(data.selectedcards[1].text == currentPlayersHand[i].text) {
          lobbyList[lobbycode].hands[username].splice(i, 1);
        }
      };
    };

    //If the data contains red cards, shuffle them to another persons hand
    if(data.selectedcards[0].type === "red") {
      var currentPlayerIndex = tempPlayerList.indexOf(username);

      if(currentPlayerIndex === (tempPlayerList.length -1)) {
        currentPlayerIndex = 0;
      }
      else {
        currentPlayerIndex++;
      }

      lobbyList[lobbycode].handsInPlay[tempPlayerList[currentPlayerIndex]] = data.selectedcards;
    }
    //If its just white cards it can just be pushed to the corresponding username
    else {
      lobbyList[lobbycode].handsInPlay[username] = data.selectedcards;
    };

    checkNextRound(lobbycode);
  });

  socket.on("start new round", function(data) {
    console.log("DEck 1 = " + lobbyList[socket.lobbycode].hands[socket])
    if(data){
      console.log("Round winner: " + data.winner);
      startNewRound(socket,2,1,data.winner);
    } 
    else {
      startNewRound(socket,2,1);
    }
  });

  socket.on("restart round", (data) =>{
    if(lobbyList[socket.lobbycode].restarts === lobbyList[socket.lobbycode].disconnects){
      console.log("Not repeating restart");
    } 
    else {
      startNewRound(socket,data.whites,0);
      lobbyList[socket.lobbycode].restarts++;
    }
  });

  socket.on("chat message", function(msg){
    io.to(socket.lobbycode).emit("chat message", {sender: socket.username, msg: msg});
  });

  socket.on('disconnect', function () {
    var connectionMessage = socket.username + " Disconnected from Socket " + socket.id;
    console.log(connectionMessage);
    removePlayer(socket.username);
    removeFromServer(socket.username,socket.lobbycode);
    checkForInvalidServer(socket.lobbycode);
    checkForEmptyServer(socket.lobbycode);
    if(lobbyList[socket.lobbycode]){
      lobbyList[socket.lobbycode].disconnects++;
      io.to(socket.lobbycode).emit("player disconnected", {username: socket.username, players: lobbyList[socket.lobbycode].players});
    }
  });
});


////////////////////////////////////////////////////Start Server + Catch All/////////////////////////////////////////
app.get("*", function(req,res) {
  res.send("Error, page not found");
})

http.listen(3024 ,function(){
  console.log('listening on *:3024');
});

///////////////////////////////////////////////////Functions/////////////////////////////////////////

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
}

/////////////////////////////////////////////////Object Creation + Player adding//////////////////////////////////////////
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

//////////////////////////////////////////////Game logic/////////////////////////////////////////////////////

function setupDecks(socket,white,red) {
  console.log(lobbyList[socket.lobbycode].players);
  console.log("Setting up decks///////////////")
    for (var i = 0; i < lobbyList[socket.lobbycode].players.length; i++) {
      var currentPlayers = lobbyList[socket.lobbycode].players
      var temp = [];
      
      //load the white cards
      for (var j = 0; j < white; j++) {
        var item = masterDeck.White[Math.floor(Math.random() * masterDeck.White.length)];
        temp.push(item);
      }
      
      //Load the red cards
      for (var j = 0; j < red; j++) {
        var item = masterDeck.Red[Math.floor(Math.random() * masterDeck.Red.length)];
        temp.push(item);
      }

      if(lobbyList[socket.lobbycode].players[i] === lobbyList[socket.lobbycode].single) {
        console.log("Not sending deck to the single");
      }
      else {
        for(let j = 0; j < temp.length; j++){
          lobbyList[socket.lobbycode].hands[currentPlayers[i]].push(temp[j])
        }
      }
    console.log("Hand " + i + ": " + JSON.stringify(lobbyList[socket.lobbycode].hands[currentPlayers[i]]));
    io.to(lobbyList[socket.lobbycode][currentPlayers[i]]).emit('deck', {hand: lobbyList[socket.lobbycode].hands[currentPlayers[i]], players: lobbyList[socket.lobbycode].players});
    }
}

function chooseRandomSingle(socket) {
  console.log("CHOOSESINGLE")
  var single = lobbyList[socket.lobbycode].players[Math.floor(Math.random() * lobbyList[socket.lobbycode].players.length)];
  var id = lobbyList[socket.lobbycode][single];
  
  lobbyList[socket.lobbycode].single = single;

  io.to(id).emit("Youre single");
  io.to(socket.lobbycode).emit("single is", {single: single});
}

function chooseNewSingle(socket) {
  console.log("CHOOSE NEW SINGLE")
  var currentSingleIndex = lobbyList[socket.lobbycode].players.indexOf(lobbyList[socket.lobbycode].single);
  if (currentSingleIndex === (lobbyList[socket.lobbycode].players.length -1)) {
    currentSingleIndex = 0;
  }
  else {
    currentSingleIndex++;
  } 

  var single = lobbyList[socket.lobbycode].players[currentSingleIndex];
  var id = lobbyList[socket.lobbycode][single];
  
  lobbyList[socket.lobbycode].single = single;

  io.to(id).emit("Youre single");
  io.to(socket.lobbycode).emit("single is", {single: single});
};

function checkNextRound(lobbycode) {
  if(Object.keys(lobbyList[lobbycode].handsInPlay).length === (lobbyList[lobbycode].players.length - 1)){
    var cardTotal = 0;
    for(let i = 0; i < lobbyList[lobbycode].players.length; i++){
      var name = lobbyList[lobbycode].players[i];
      if(lobbyList[lobbycode].handsInPlay[name]){
        cardTotal += lobbyList[lobbycode].handsInPlay[name].length;
      }
    }
    var division = (cardTotal/((lobbyList[lobbycode].players.length)-1));
    if(division === 2) {
      io.to(lobbycode).emit("finished white stage", {hands: lobbyList[lobbycode].handsInPlay});
    }
    else if (division === 1) {
      io.to(lobbycode).emit("finished red stage", {hands: lobbyList[lobbycode].handsInPlay});
    }
  }
};

function startNewRound(socket,white,red,winner) {
  io.to(socket.lobbycode).emit("clear singles");
  lobbyList[socket.lobbycode].handsInPlay = {};
  console.log("SINGLE: " + lobbyList[socket.lobbycode].single);
  setupDecks(socket,white,red);
  chooseNewSingle(socket);
  io.to(socket.lobbycode).emit("new round started", {winner: winner, players: lobbyList[socket.lobbycode].players});
};

//////////////////////////////////////////////Server exit///////////////////////////////////////////////////
function removePlayer(username) {
  for (var i = 0; i < playerList.length; i++) {
    if (playerList[i].username === username) {
      playerList.splice(i,1)
      console.log("playerlist: " + playerList)
    }
  }
};

function removeFromServer(username,lobbycode) {
  console.log("Removing " + username + "from server")
  if(lobbyList[lobbycode]){
    lobbyList[lobbycode].players.forEach(function(element,index) {
      if(username === element){
        lobbyList[lobbycode].players.splice(index, 1);
        delete lobbyList[lobbycode].hands[username];
        delete lobbyList[lobbycode][username];
        console.log("Single = " + lobbyList[lobbycode].single);
        console.log("Username = " + username);
        if(username === lobbyList[lobbycode].single){
          lobbyList[lobbycode].single = "";
          console.log("SINGLE HAS LEFT GAME");
        }
      };
    });
  };
  console.log("Server = " + JSON.stringify(lobbyList[lobbycode]));
};

function checkForEmptyServer(lobbycode) {
  if(lobbyList[lobbycode]){
    if (lobbyList[lobbycode].players.length === 0) {
      delete lobbyList[lobbycode];
    };
  }
};

function checkForInvalidServer(lobbycode){
  if(lobbyList[lobbycode]){
    if((lobbyList[lobbycode].players.length < 3) && (lobbyList[lobbycode].gameStarted === true)){
      for(let i = 0; i < lobbyList[lobbycode].players.length;i++){
        lobbyList[lobbycode].hands[lobbyList[lobbycode].players[i]] = [];
      };
      lobbyList[lobbycode].gameStarted = false;
      console.log("ERROR, too few in lobby");
      io.to(lobbycode).emit("invalid lobby", lobbyList[lobbycode].players);
    }
  }
}



