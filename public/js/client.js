var username = prompt("Enter your username");

var hostname = window.location.hostname;



var socket = io.connect(hostname,username);

var timerHandle;
var startTime;

socket.on('connect',function(){
	socket.emit('set_name',username);
	$('#log').append('Connected to server<br>');
});

socket.on('queue',function(){
	$('#log').append('In game queue<br>');
});
 
socket.on('join room',function(data,players){
	$('#log').append('Joined room '+data+'<br>Press (space) to start.<br>');
});

socket.on('start',function(data){
	$('#log').append('Game start<br>'+data[0]+' vs '+data[1]+'<br');
	if(timerHandle){
		clearInterval(timerHandle);
	}
	startTime = new Date().getTime();
	timerHandle = setInterval(tick,1);
});

function tick(){
	var t = Math.max(0,(5-(new Date().getTime()-startTime)/1000.0));
	$('#timer').text('Time: '+t.toFixed(3)+'s');
}

socket.on('tie',function(data){
	if(timerHandle){
		clearInterval(timerHandle);
	}
	$('#log').append('tie');
});

socket.on('win',function(data){
	if(timerHandle){
		clearInterval(timerHandle);
	}
	$('#log').append('you win<br>');
	socket.emit('submit',prompt('Enter site submission'));
});

socket.on('lose',function(data){
	window.location.replace(data);
});

function checkKey(e){
	if(e.keyCode==32){
		socket.emit('hold');
		$('#log').append(' space <br>');
	}
	else if (e.keyCode==13){
		if(timerHandle){
			clearInterval(timerHandle);
		}
		socket.emit('release');
		$('#log').append(' release<br>');
	}
	//else alert(e.keyCode);
}

if ($.browser.mozilla) {
    $(document).keypress (checkKey);
} else {
    $(document).keydown (checkKey);
}