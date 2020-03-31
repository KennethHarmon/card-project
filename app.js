///////////////////////////REQUIRES/////////////////////////////////

var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static("public"));
app.set("view engine", "ejs")

///////////////////////////////////MONGOOSE SECTION//////////////////////////

var mongoose = require("mongoose");
mongoose.set('useUnifiedTopology', true);
mongoose.set('useNewUrlParser', true);
mongoose.connect("mongodb://localhost/demo")

//Card schema
var cardSchema = new mongoose.Schema({
  text: String,
  type: String
})

var Card = mongoose.model("Card", cardSchema);

//Hand Schema
var handSchema = new mongoose.Schema({
  username: String,
  cards: [cardSchema]
})
var Hand = mongoose.model("Hand", handSchema)

//Lobby schema
var lobbySchema = new mongoose.Schema({
  Servername: String,
  players: [],
  password: String,
  lobbyCode: String,
  hands: [handSchema]
});

var Lobby = mongoose.model("Lobby", lobbySchema);

//Player Schema
var playerSchema = new mongoose.Schema({
  username: String,
  ip: String
})

var Player = mongoose.model("Player", playerSchema)

////////////////////////////////////////////PAGE ROUTES////////////////////////////////////////

//Serve index page
app.get('/', function(req, res){
  res.render("index")
});

//Serve game page
app.get("/game", function(req,res) {
  res.render("game", {username: req.query.username, lobbycode: req.query.lobbycode})
})

app.post("/game/join", function(req,res) {
  var ip = req.header('x-forwarded-for') || req.connection.remoteAddress;
  console.log(req.body.username)
  var username = req.body.username.toLowerCase();
  var gameCode = req.body.gameCode;

  checkUserExists(username, function(existsResponse) {
    if (existsResponse === 1) {
      console.log("No user exists")
      createPlayer(username, ip);
      addToLobby(username,gameCode);
      res.redirect("/game?username=" + username + "&lobbycode=" + gameCode);
    }
    else {
      console.log("User already exists, can't join lobby")
      res.redirect("/");
    }
  });

})

//Create a new game
app.post('/game/new', function(req, res){
  var ip = req.header('x-forwarded-for') || req.connection.remoteAddress;
  var username = req.body.username.toLowerCase();

  checkUserExists(username, function(existsResponse) {
    if (existsResponse === 1) {
      console.log("No user exists")
      createPlayer(username, ip);
      createLobby(username, ip, function(code) {
        console.log("Code: " + code)
        res.redirect("/game?username=" + username + "&lobbycode=" + code);
      });
    }
    else {
      console.log("User already exists, can't create lobby")
      res.redirect("/");
    }
  });

});

//Serve cards page
app.get('/cards', function(req, res){
  var cards = [];
  Card.find({}, function(err, cardsResponse){
    if(err) {
      console.log("Error retrieving cards from database");
    }
    else {
      cardsResponse.forEach(function(el) {
        cards.push(el)
      } )
    }
    res.render('cardview', {cards: cards})
  })
});

//Serve index page
app.get('/cards/new', function(req, res){
  res.render("cardcreate")
});

app.post("/cards", function(req,res) {
  console.log(req.body.text)
  var newCard = new Card({
    text: req.body.text,
    type: req.body.type
  });
  newCard.save(function(err, saved) {
    if(err){
      console.log("Problem saving to database");
    }
    else {
      console.log(saved + " was saved to the database")
    }
  });
  res.redirect("/cards")
});

////////////////////////////////////////////////SOCKET.IO SECTION/////////////////////////////////////////

//Once a socket has connected
io.on('connection', function (socket) {
  console.log("user has connected: " + socket.id)

  socket.on("newUser", function(data) {
    socket.username = data.username;
    socket.lobbycode = data.lobbycode;
    console.log("Socket Username: " + socket.username);
    console.log("Socket LobbyCode: " + socket.lobbycode)
  })

  //User has tried connect to room => data.room
  socket.on("connect to room", function(data){
    console.log('User trying to connect to room ' + data.room);
    //Join specified room
    socket.join(data.room);
    //Transmit to the client they are connected to specified room
    io.to(data.room).emit("connectedRoom", { room: data.room, socket: socket.id});
  });

  socket.on("Start game", function() {
    console.log("Game started in room: " + socket.lobbycode + " by " + socket.username)
    io.to(socket.lobbycode).emit("StartGame", {lobbycode:socket.lobbycode, username: socket.username})
  })

  //When a client tries to broadcast a messge to their room
  socket.on("room message", function(data){
    console.log(data);
    io.to(socket.lobbycode).emit("recievedmessage", { message: data.message});
  });

  socket.on('disconnect', function () {
    var connectionMessage = socket.username + " Disconnected from Socket " + socket.id;
    console.log(connectionMessage);
    removePlayer(socket.username);
    removeFromServer(socket.username, socket.lobbycode);
    checkForEmptyServer();
  });
});


////////////////////////////////////////////////////Start Server + Catch All/////////////////////////////////////////
app.get("*", function(req,res) {
  res.send("Error, page not found");
})

http.listen(3000 ,function(){
  console.log('listening on *:3000');
});

///////////////////////////////////////////////////Functions/////////////////////////////////////////

/////Returns: (2 = error, 1 = user exists, 0 = no user exists)
function checkUserExists(username, callback) {
  var response = Player.find({username: username}, function(err, playerResponse){
  if(err) {
    console.log("Error trying to get user data")
  }
  else if (playerResponse.length === 0){
    callback(1);
  }
  else {
    callback(0);
  }
})
}

//Create a player object with given username and ip and store it in the database
function createPlayer(username,ip) {
  var player = new Player({
    username: username,
    ip: ip
  })

  player.save(function(err,saved) {
    if(err) {
      console.log("error saving player")
    }
    else {
      console.log("player saved")
    }
  })
}

//Create a lobby object with given username and ip and store it in the database
function createLobby(username, ip, callback) {
  //Create a new lobby
  generateLobbyCode(function(code) {
    var newLobby = new Lobby({
      Servername: username + "'s Server",
      players: [username],
      lobbyCode: code
    });
  
    newLobby.save(function(err, saved) {
      if(err) {
        console.log("Problem setting up a new lobby.")
      }
      else {
        console.log("Setup new lobby")
      }
    })

    callback(code);
  })
}

function generateLobbyCode(callback) {
  var code = Math.floor(100000 + Math.random() * 900000);
  Lobby.find({lobbyCode: code}, function(err, response) {
    if(err) {
      console.log("error generating lobby code")
    }
    else if(response.length == 0) {
      console.log("no matching lobby code")
      callback(code);
    }
    else {
      console.log("Matching lobby codes!!!!!!!!!!! Generating new code");
      var newcode = Math.floor(100000 + Math.random() * 900000);
      callback(newcode);
    }
  })
}

function removePlayer(username) {
  Player.deleteOne({"username":username}, function (err) {
    if(err) console.log(err);
    console.log("Successful deletion");
  })
}

function removeFromServer(username,lobbycode) {
  console.log("removing: " + username)

  Lobby.find({lobbyCode: lobbycode}, function (err, response) {
    var Servername = response.Servername;
    console.log(response)
    var index = response[0].players.indexOf(username);
    response[0].players.splice(index,1);
    Lobby.updateOne({lobbyCode: lobbycode}, {$set: {"players":response[0].players}}, function(err,response) {
      if(err) {
        console.log(err)
      }
    })
  })
}

function checkForEmptyServer() {
  Lobby.deleteMany({"players":{$size: 0}}, function(err, response) {
    if (err) console.log("err");
    console.log("empty server found")
  })
}

function addToLobby(username,gameCode) {
  Lobby.find({lobbyCode: gameCode}, function (err, response) {
    var Servername = response.Servername;
    console.log(response)
    response[0].players.push(username);
    Lobby.updateOne({lobbyCode: gameCode}, {$set: {"players":response[0].players}}, function(err,response) {
      if(err) {
        console.log(err)
      }
    })
  })
}


