var socket = null;
var username = "";

var timerHandle;
var startTime;
var shakeInterval;
var room=0;
var wins=0;

var crackTimer = [null,null,null,null,null,null,null,null];

function init(){

	
	var hostname = window.location.hostname;
	
	socket = io.connect(hostname,username);
	
	socket.on('connect',function(){
		socket.emit('set_name',username);
		send_msg('Connected to server<br>');
	});
	
	socket.on('queue',function(){
		send_msg('In game queue<br>');
	});
	 
	socket.on('join room',function(data,players){
		room = 1;
		send_msg('Joined room '+data+'<br>'+players[0]+' vs '+players[1]+'<br>Hold (space) to start.<br>');
		startTime = new Date().getTime();
		if(timerHandle)clearInterval(timerHandle);
		timerHandle = setInterval(tick2,1);
		$("#versus").text(players[0]+" vs "+players[1]);
	});
	
	socket.on('start',function(){
		room = 2;
		send_msg('Game start<br>');
		if(timerHandle){
			clearInterval(timerHandle);
		}
		
		for(var i =1;i<=8;i++){
			crackTimer[i-1] = window.setTimeout(function(c){
				$('#crack'+c).fadeIn(100,"easeInOutBounce");
			},600*i,i);
			
		}
		
		/*
		shakeInterval = window.setInterval(function(){
			$('egg').animate({left:"+=20px"},10);
			$('egg').delay(10).animate({left:"+=2px"},10);
			for(var i =1;i <= 8;i++){
				$('crack'+i).animate({left:"+=2px"},10);
				$('crack'+i).delay(10).animate({left:"+=2px"},10);
			}
		},30);*/
		
		
		startTime = new Date().getTime();
		timerHandle = setInterval(tick,1);
	});
	socket.on('tie',function(data){
		if(timerHandle){
			clearInterval(timerHandle);
		}
		send_msg('tie<br>');
	});

	socket.on('win',function(data){
		if(timerHandle){
			clearInterval(timerHandle);
		}
		wins++;
		$('#wins').text('Wins: '+wins);
		$('#versus').text('');
		
		$('#url-div').delay(1000).fadeIn(1000);
		
		
	});

	socket.on('lose',function(data){
		
		for(var i=1;i<=8;i++)$('#crack'+i).show();
		setTimeout(function(){
			for(var i=1;i<=8;i++)$('#crack'+i).hide();
			$('#egg').hide();
			$('#egg1').show();
			$('#egg2').show();
			$('#egg1').animate ({left: "0px"}, 200);
			$('#egg1').fadeOut(200);
			$('#egg2').animate ({left: "500px"}, 200);
			$('#egg2').fadeOut(200);
		},200);
		
		
		window.setTimeout(function(){
			window.location.replace(data);
			},500);
	});

}

function send_msg(msg){
	$("#log").append(msg);
	var elm = document.getElementById('log');
	elm.scrollTop = elm.scrollHeight;
	
}

function tick(){
	var t = Math.max(0,(5-(new Date().getTime()-startTime)/1000.0));
	$('#timer').text('Time: '+t.toFixed(3)+'s');
}

function tick2(){
	var t = Math.max(0,(10-(new Date().getTime()-startTime)/1000.0));
	$('#timer').text('Time to press space: '+t.toFixed(3)+'s');
}




function checkKey(e){ 
	if(e.which=='13'){
		e.preventDefault();
	}
	if(e.which=='32'){
		e.preventDefault();
		if(socket!=null)socket.emit('hold');
	}
}
function releaseKey(e){
	if(e.which=='13'&&room == 2){
		if(timerHandle){
			clearInterval(timerHandle);
		}
		
		for(var i =1;i<=8;i++){
			window.clearTimeout(crackTimer[i-1]);
		}
		
		socket.emit('release');
		room = 0;
		//$('#log').append(' release<br>');
	}
}


 $(document).keydown (checkKey);


$(document).keyup(releaseKey);


$(document).ready (function() {
	$('#submit-username').click(function() {
		username = document.getElementById('username').value;
		init();
		$('#username-div').fadeOut(500);
		$('#egg').delay(500).fadeIn(1000);
	});
	$('#submit-url').click(function(){
		var site = document.getElementById('url').value;
		socket.emit('submit',site);
		for(var i=1;i<=8;i++)$('#crack'+i).hide();
		$('#url-div').fadeOut(500);
		$('#egg1').fadeOut(500);
		$('#egg2').fadeOut(500);
		$('#egg1').delay(500).css({left:200});
		$('#egg2').delay(500).css({left:200});
		$('#egg').delay(500).fadeIn(1000);
	});
});