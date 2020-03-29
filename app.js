var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.use(express.static("public"));
app.set("view engine", "ejs")

//Serve index page
app.get('/', function(req, res){
  res.render("index")
  console.log(api.deck("VVVHA"))
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
    io.to(data.room).emit("connectedRoom", { room: data.room});
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