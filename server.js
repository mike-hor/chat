//*****************************************
// var favicon = require('serve-favicon');
// var logger = require('morgan');
// var cookieParser = require('cookie-parser');
// var bodyParser = require('body-parser');

// var routes = require('./routes/index');
// var users = require('./routes/users');
//*****************************************
var express = require('express');
var app =express();
var bodyParser = require('body-parser');
var multer  = require('multer');
var fs = require('fs');     // 文件系统API
var path = require('path');
var server = require('http').Server(app);
var io = require('socket.io')(server);
var schedule = require('node-schedule');
/*********************************************************/
var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : '182.92.229.15',//地址
  port : 3306,
  database : 'mxh',
  user     : 'mxh',
  password : 'qwertyuiopmxh' 
});
//*******************************************************************************************************
// 新浪云存储实例
var SinaCloud = require('scs-sdk');//初始化
//配置
var config = new SinaCloud.Config({
    accessKeyId: '1f86l1l8PkZc5i5n7Az0', 
    secretAccessKey: '8426a4849615724f012622190f09f106c234d3c2',
    sslEnabled: false
});
//全局生效:
SinaCloud.config = config;
//实例化
var s3 = new SinaCloud.S3();
// 获取新浪云bucket文件url
function geturl (key) {
  var params = {Bucket: 'chat-bucket', Key: key, Expires: 60}; //key=pic/1.jpg
  var url = s3.getSignedUrl('getObject', params);
  return url;
}
//随机文件名
function randomString(len) {
　　len = len || 32;
　　var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
　　var maxPos = $chars.length;
　　var pwd = '';
　　for (i = 0; i < len; i++) {
　　　　pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
　　}
　　return pwd;
}
/*******************************************************************************************************************/
 //var j = schedule.scheduleJob('* */1 * * * *', function(){
   setInterval(function () {
  console.log('新的一轮游戏一分钟后开始');
   io.emit('gameredy');
  game.gamestate = true;
  var type = Math.floor(Math.random()*3+1) ; //返回1-3的整数随机的游戏类型
 //var type = 1;
  switch (type)
   {
    case 1:
      game.type = "music";
      break;
    case 2:
      game.type = "picture";
      break;
    case  3:
      game.type = "word";
      break;
   }
//读取数据库获取游戏数据
connection.query('select * from chat_' + game.type + ' order by rand() limit 1' , function(err, rows, fields) {
 if (err) {
       console.log(err);
    }
  game.question = rows[0].question;  //得到问题
  if(((game.type == "music") && (path = 'music')) || ((game.type == "picture") && (path = 'pic'))){
    var path;
    var array = game.question.split(","); 
    game.question = geturl(path+ '/'+array[0]);
    game.info = array[1];
  }  
  game.answer = rows[0].answer;//得到问题的答案
  console.log('问题:'+game.question+'   问题答案:'+game.answer + ' 问题信息:'+game.info);
});
//游戏正式开始
   setTimeout(function () {
     console.log('游戏正式开始');
     game.gamewiner ="0";
     if(game.type == "music" || game.type == "picture"){
       io.emit('gamestart', {gamestate:game.gamestate,gametype:game.type,gamequestion:game.question,gameinfo:game.info});
     }else{
       io.emit('gamestart', {gamestate:game.gamestate,gametype:game.type,gamequestion:game.question});
    }
      timer1 = setTimeout(function () {
        console.log('延时函数');
      if (game.gamewiner =='0') {
        game.gamestate = false;
        io.emit('gameover');
        console.log('没有人猜出');
        game=[];  //重新初始化game数组
        game.gamestate = false ;
      };
      // },60*1000*3);
       },60*1000);
     },60*1000);
   },60*1000*3);
  //  io.emit('gamestart', {gamestate:game.gamestate,gametype:game.type});  
// }); 
/****************************************************************************************************************/
//在线用户
var game = [];
var onlineUsers =[];
//当前在线人数
var onlineCount = 0;
var timer1;
io.on('connection', function(socket){
  console.log("新的客户端建立连接");
  socket.on('login', function(data){
       //将新加入用户的唯一标识当作socket的名称，后面退出的时候会用到
        socket.name = data.userid;
        //检查在线用户列表，如果不存在则加入
        if(!onlineUsers.hasOwnProperty(data.userid)) {
           onlineUsers[data.userid] = data.username;
           onlineCount++;
      }
       //向所有客户端广播用户加入
       //onlineUsers.push(data.userid);
        io.emit('login', {onlineCount:onlineCount,userid:data.userid,users:onlineUsers});
        console.log(data.userid+'加入了聊天室');  
        io.sockets.connected[socket.id].emit('pravite', {id:socket.id});
  });
  socket.on('disconnect', function(){ 
      if(onlineUsers.hasOwnProperty(socket.name)) {
            console.log("客户端断开连接.");
            console.log('删除用户之前'+onlineUsers);
            delete onlineUsers[socket.name];
            //在线人数-1
            onlineCount--;    
            console.log('删除用户之后'+onlineUsers);        
            //向所有客户端广播用户退出
            io.emit('logout', {onlineCount:onlineCount, userid:socket.name});
            console.log(socket.name+'退出了聊天室');
       }       
  });
  socket.on('message', function(data){
        //向所有客户端广播发布的消息
        console.log(game.answer);
        if (game.gamestate &&  game.answer !=''){
          if (data.content == game.answer){
            io.emit('gamewiner',{gamewiner:data.userid});
            game=[];  //重新初始化game数组
            game.gamestate = false ;
            clearTimeout(timer1);
            console.log(data.userid+'赢得了游戏'+game.type);
          }
        }
        io.emit('message',data);
        console.log(data.userid+'说：'+data.content);
    });
});
//express基本配置
  app.set('port', process.env.PORT || 5050);
  app.set('views', __dirname + '/views');
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
// 指定webscoket的客户端的html文件
app.get('/', function(req, res){
  res.sendfile('views/client.html');
});
app.get('/admin', function(req, res){
  res.sendfile('views/admin.html');
});
//提交文字游戏的接口
app.post('/addgame_word',function(req,res){
  var upload = multer().single('question');
    upload(req, res, function (err) {
  if (err) {
    return
  }

  var question = {};
  console.log(req.body);
  question.answer = req.body.answer;
  question.name = req.body.question;
       /*****************向数据库添加数据**********/
      connection.query('insert into ' + 'chat_word(question,answer) values("' + question.name + '", "' + question.answer + '")', function(err, rows, fields) {
       if (err) {
       console.log(err);
      }
      res.send('ok');
      });
      /***********************************************/ 
     }); 
});
//提交图片游戏的接口
app.post('/addgame_picture',function(req,res){
  var upload = multer().single('question'); //不设置上传目录获取到文件的buffer二进制流 用于后面的sina云的上传
  var question = {};
  var file_name = '';
  var file_type ='';
  upload(req, res, function (err) {
  if (err) {
    return
  }
  question.answer = req.body.answer;
  question.info = req.body.info||'';
  file_type = req.file.mimetype.split("/"); 
  // Everything went fine
  console.log(req.body);
  // console.log(req.file);
 console.log(req.file.mimetype);
 file_name = randomString(8)+'.'+file_type[1];
var params = {Bucket: 'chat-bucket', Key: 'pic/'+file_name, Body: req.file.buffer};
s3.putObject(params).on('httpHeaders', function(statusCode, headers) { 
    console.log(headers);
}).on('httpUploadProgress', function(progress) {
    console.log(progress);
}).on('error', function(error) {
    console.log(error);
}).on('success', function() {
    console.log('success');
      //res.send('ok');上传完成返回成功
       /*****************向数据库添加数据**********/
      connection.query('insert into ' + 'chat_picture(question,answer) values("' + file_name + ',' + question.info + '", "' + question.answer + '")', function(err, rows, fields) {
       if (err) {
       console.log(err);
      }
      });
      /***********************************************/
      res.send('ok');
}).send();
  })

});
//提交音乐游戏的接口
app.post('/addgame_music',function(req,res){
  var upload = multer().single('question'); //不设置上传目录获取到文件的buffer二进制流 用于后面的sina云的上传
  var question = {};
  var file_name = '';
  var file_type ='';
  upload(req, res, function (err) {
  if (err) {
    return
  }
  question.answer = req.body.answer;
  question.info = req.body.info||'';
  file_type = req.file.mimetype.split("/"); 
  // Everything went fine
  console.log(req.body);
  // console.log(req.file);
 console.log(req.file.mimetype);
 file_name = randomString(8)+'.'+file_type[1];
var params = {Bucket: 'chat-bucket', Key: 'music/'+file_name, Body: req.file.buffer};
s3.putObject(params).on('httpHeaders', function(statusCode, headers) { 
    console.log(headers);
}).on('httpUploadProgress', function(progress) {
    console.log(progress);
}).on('error', function(error) {
    console.log(error);
}).on('success', function() {
    console.log('success');
      //res.send('ok');上传完成返回成功
       /*****************向数据库添加数据**********/
      connection.query('insert into ' + 'chat_music(question,answer) values("' + file_name + ',' + question.info + '", "' + question.answer + '")', function(err, rows, fields) {
       if (err) {
       console.log(err);
      }
      });
      /***********************************************/
      res.send('ok');
}).send();
  })

});
// server.listen(app.get('port'), function(){
//   console.log("服务器开始工作 端口: " + app.get('port'));
// });

server.listen(5050, function (req, res) {
  console.log('服务器开始工作');
});
