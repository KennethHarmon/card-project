var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
mongoose.set('useUnifiedTopology', true);
mongoose.set('useNewUrlParser', true);
mongoose.connect("mongodb://localhost/demo")

var cardSchema = new mongoose.Schema({
  text: String,
  type: String
})

var Card = mongoose.model("Card", cardSchema);

app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static("public"));
app.set("view engine", "ejs")

//Serve index page
app.get('/', function(req, res){
  res.render("index")
});

//Serve cards page
app.get('/cards', function(req, res){
  var cards = [];
  console.log("Cards resonse 11")
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
app.get('/game', function(req, res){
  res.render("game")
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

//Once a socket has connected
io.on('connection', function (socket) {
  console.log("user has connected: " + socket.id)

  //User has tried connect to room => data.room
  socket.on("connect to room", function(data){
    console.log('User trying to connect to room ' + data.room);
    //Join specified room
    socket.join(data.room);
    //Transmit to the client they are connected to specified room
    io.to(data.room).emit("connectedRoom", { room: data.room, socket: socket.id});
  });

  //When a client tries to broadcast a messge to their room
  socket.on("room message", function(data){
    console.log(data);
    io.to(data.room).emit("recieved", { message: data.message});
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});