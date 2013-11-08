var username = prompt("Enter your username");
var socket = io.connect('127.0.0.1:3000',username);
socket.on('connect',function(){
	socket.emit('username',username);
	$('#log').append('Connected to server\n');
});

socket.on('queue',function(){
	$('#log').append('In game queue<br>');
});
 
socket.on('join room',function(data){
	$('#log').append('joined room '+data+'<br>');
});

socket.on('start',function(data){
	$('#log').append('game start<br>');
});

socket.on('win',function(data){
	$('#log').append('you win<br>');
});

socket.on('lose',function(data){
	window.location.replace("http://www.google.ca");
});

function checkKey(e){
	if(e.keyCode==32){
		socket.emit('hold');
		$('#log').append(' space <br>');
	}
	else if (e.keyCode==13){
		socket.emit('release');
		$('#log').append(' release<br>');
	}
	else alert(e.keyCode);
}

if ($.browser.mozilla) {
    $(document).keypress (checkKey);
} else {
    $(document).keydown (checkKey);
}