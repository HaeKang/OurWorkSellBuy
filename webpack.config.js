const webpack = require('webpack')
const path = require('path')
const fs = require('fs')
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./src/index.js",
  mode: 'development',
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, 'dist')   
  },

  module:{
    rules:[
      {
        test:/\.css$/,
        use:['style-loader','css-loader']
      }
    ]
  },

  plugins: [   
    new webpack.DefinePlugin({
      DEPLOYED_ADDRESS: JSON.stringify(fs.readFileSync('deployedAddress', 'utf8').replace(/\n|\r/g, "")),
      DEPLOYED_ABI: fs.existsSync('deployedABI') && fs.readFileSync('deployedABI', 'utf8'),

      DEPLOYED_ADDRESS_TOKENSALES: JSON.stringify(fs.readFileSync('deployedAddress_TokenSales', 'utf8').replace(/\n|\r/g, "")),
      DEPLOYED_ABI_TOKENSALES: fs.existsSync('deployedABI_TokenSales') && fs.readFileSync('deployedABI_TokenSales', 'utf8')
    }),
    new CopyWebpackPlugin([{ from: "./src/index.html", to: "index.html"}])
  ],
  //devServer: { contentBase: path.join(__dirname, "dist"), compress: true }

  devServer: {
    inline: true,

    port: 3000,

    publicPath: '/',

    historyApiFallback : true,

    // 서버 작성
    before : function(app){

          var bodyParser = require('body-parser');    
          app.use(bodyParser.json());


          //mysql연결
          var mysql = require('mysql');
          var connection = mysql.createConnection({
                                host: '127.0.0.1',
                                user: 'hk',
                                password: '1234',
                                port: 3306,
                                database: 'BlockChain'
                            });

          connection.connect();


          app.get("/admin-report", function(req, res){
              res.sendFile(__dirname + '/src/admin.html');         
          });
          
           // 신고 개수 1개 이상인것들 불러옴
           app.post("/admin_report_list", bodyParser.json(), function(req, res){           

            var sql = 'select token_id, sum(report_check) as report_count from report group by token_id having sum(report_check) >= 1';
            
            connection.query(sql, function (error, result) {
              res.send(result)
            });

          });

          
          // 쪽지함 불러오기 4개씩 끊어서
          app.post("/notebox/:page", bodyParser.json(), function(req, res){           
            var address = req.body.address;
            var post = req.body.page;

            var sql = 'select sender, contents, note_id from message where receiver = ? order by note_id desc';
            
            connection.query(sql, [address] , function (error, result) {
              if(error){ console.log(error); }  
              res.send(result)
            });
          });


          // 쪽지 글 보기
          app.post("/note_read", bodyParser.json(), function(req, res){           
            var note_id = req.body.note_id;

            var sql = 'select sender, contents from message where note_id = ?';

            connection.query(sql, [note_id] , function (error, result) {
              if(error){ console.log(error); }
              res.send(result)
            });
          });


          // 쪽지 보내기
          app.post("/send", bodyParser.json(), function(req, res){           
              var sender = req.body.sender;
              var receiver = req.body.receiver;
              var contents = req.body.contents;

              var sql = 'insert into message(sender,receiver,contents) values(?,?,?)';
              connection.query(sql, [sender,receiver,contents] , function (error, result) {
                if(error){ console.log(error); }
              });
          });


          // 쪽지 삭제하기
          app.post("/note_delete", bodyParser.json(), function(req, res){           
            var note_id = req.body.note_id;

            var sql = 'delete from message where note_id = ?';
            connection.query(sql, [note_id] , function (error, result) {
              if(error){ console.log(error); }
              console.log("note_id 삭제 : " + note_id);
              res.send(result);
            });
        });


          // 토큰발생 DB로 전송
          app.post("/tokencreate", function(req, res){           
            var author = req.body.author;
            var regi_date = req.body.regi_date;
            var category = req.body.category;
            var work_id = req.body.work_id;
            var description = req.body.description;

            var sql = 'insert into kategorie(author, regi_date, category, work_id, description) values(?,?,?,?,?)';

            connection.query(sql, [author, regi_date, category, work_id, description] , function (error, result) {
              if(error){ console.log(error); }
            });

        });

          // 관심 작가 추가
          app.post("/add_myfavWorker", function(req, res){           
            var myaddress = req.body.myaddress;
            var worker = req.body.worker;

            var sql = 'insert into fvWorker(myaddress, worker) values(?,?)';

            connection.query(sql, [myaddress, worker] , function (error, result) {
              if(error){ 
                console.log(error); 
                res.send(error);
              } else{
                res.send(result);
              }

              
            });

        });

          // 관심 작가 찾기
          app.post("/find_myfvworker", function(req, res){           
            var myaddress = req.body.myaddress;

            var sql = 'select worker,fav_id from fvWorker where myaddress = ?';

            connection.query(sql, [myaddress] , function (error, result) {
              if(error){ 
                console.log(error); 
                res.send(error);
              } else{
                res.send(result);
              }

              
            });

        });

          // 관심 작가 삭제
          app.post("/delete_myfvworker", function(req, res){           
            var fav_id = req.body.fav_id;

            var sql = 'delete from fvWorker where fav_id = ?';

            connection.query(sql, [fav_id] , function (error, result) {
              if(error){ 
                console.log(error); 
                res.send(error);
              } else{
                res.send(result);
              }        
            });

        });

          // 이미지 중복확인 클릭 시 image 테이블에 넣음
        app.post("/imageinsert", function(req, res){           
            var image = req.body.image;

            var sql = 'insert into image(image, dupli) values(?,?)'

            connection.query(sql, [image,"0"] , function (error, result) {
                
            });
        });


        app.post("/imageresult", function(req, res){           
          var image = req.body.image;

          var sql = 'insert into image(image, dupli) values(?,?)'

          connection.query(sql, [image] , function (error, result) {
              
          });
      });

        
        // 카테고리 검색
        app.post("/search_category_token", bodyParser.json(), function(req, res){           
          var category = req.body.category;
          var sql = ""
          if(category == "all"){
            sql = 'select token_id from kategorie';
          } else{
            sql = 'select token_id from kategorie where category = ?';
          }

          connection.query(sql, [category] , function (error, result) {
            if(error){ console.log(error); }
            res.send(result)
          });
        });
        

      // input 검색
      app.post("/search_input_token", bodyParser.json(), function(req, res){           
        var search_type = req.body.search_type;
        var keyword = req.body.keyword;
        var sql = ""

        if(search_type == "키워드"){

          keyword = "%" + keyword + "%";
          sql = 'select token_id from kategorie where description LIKE ? OR work_id LIKE ?';

          connection.query(sql, [keyword,keyword] , function (error, result) {
            if(error){ console.log(error); }
            res.send(result)
          });

        } else if (search_type == "작품아이디"){

          sql = 'select token_id from kategorie where work_id = ?';

          connection.query(sql, [keyword] , function (error, result) {
            if(error){ console.log(error); }
            res.send(result)
          });

        } else if (search_type == "토큰아이디"){

          sql = 'select token_id from kategorie where token_id = ?';

          connection.query(sql, [keyword] , function (error, result) {
            if(error){ console.log(error); }
            res.send(result)
          });

        } else if (search_type == "등록날짜"){

          sql = 'select token_id from kategorie where regi_date = ?';
          
          connection.query(sql, [keyword] , function (error, result) {
            if(error){ console.log(error); }
            res.send(result)
          });

        } else if (search_type == "작가"){

          sql = 'select token_id from kategorie where author = ?';
          
          connection.query(sql, [keyword] , function (error, result) {
            if(error){ console.log(error); }
            res.send(result)
          });
          
        }

       
      });


      // 신고
       app.post("/report_work", function(req, res){           
        var token_id = req.body.token_id;
        var address = req.body.address;

        var sql1 = 'select * from report where token_id = ? and address = ?'
        var sql2 = 'insert into report(token_id, address, report_check) values(?,?,?)';

        connection.query(sql1, [token_id, address] , function (error, result) {
          if(error){ 
            console.log(error); 
          } else{
            if(!result.length){
              connection.query(sql2, [token_id, address, "1"] , function (error, result) {
                if(error){ console.log(error); }
                res.send(result)
              });
            } else{
              res.send(result);
            }
          }    
        });

      });

       // 삭제된 목록
       app.post("/delete_worklist", function(req, res){           

        var sql = 'select * from delete_work'

        connection.query(sql, function (error, result) {
          if(error){ 
            console.log(error); 
          } else{
              res.send(result);
          }    
        });

      });

      // 삭제하기
       app.post("/delete_work", function(req, res){     

        var token_id = req.body.token_id;
        var sql = 'insert into delete_work(token_id) values(?)'

        connection.query(sql, [token_id] , function (error, result) {
          if(error){ 
            console.log(error); 
          }   
        });

      });


    }    
  }
}