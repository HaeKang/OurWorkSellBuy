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
                                user: 'root',
                                password: '1234',
                                port: 3306,
                                database: 'test'
                            });

          connection.connect();


          app.get("/test", function(req, res){
              console.log(req);
              res.sendFile(__dirname + '/src/test.html');         
          });
          
          
          // 쪽지함 불러오기 4개씩 끊어서
          app.post("/notebox/:page", bodyParser.json(), function(req, res){           
            var address = req.body.address;
            var post = req.body.page;

            var sql = 'select sender, contents, note_id from note where receiver = ? order by note_id desc';
            
            connection.query(sql, [address] , function (error, result) {
              if(error){ console.log(error); }  
              res.send(result)
            });
          });


          // 쪽지 글 보기
          app.post("/note_read", bodyParser.json(), function(req, res){           
            var note_id = req.body.note_id;

            var sql = 'select sender, contents from note where note_id = ?';

            connection.query(sql, [note_id] , function (error, result) {
              if(error){ console.log(error); }
              res.send(result)
              console.log(result)
            });
          });


          // 쪽지 보내기
          app.post("/send", bodyParser.json(), function(req, res){           
              var sender = req.body.sender;
              var receiver = req.body.receiver;
              var contents = req.body.contents;

              var sql = 'insert into note(sender,receiver,contents) values(?,?,?)';
              connection.query(sql, [sender,receiver,contents] , function (error, result) {
                if(error){ console.log(error); }
                console.log("result : " + result);
              });
          });


          // 쪽지 삭제하기
          app.post("/note_delete", bodyParser.json(), function(req, res){           
            var note_id = req.body.note_id;

            var sql = 'delete from note where note_id = ?';
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
            var image = req.body.image;

            var sql = 'insert into category(author, regi_date, category, work_id, description) values(?,?,?,?,?)';
            var sql2 = 'insert into image(image) values(?)'

            connection.query(sql, [author, regi_date, category, work_id, description] , function (error, result) {
                
            });

            connection.query(sql2, [image] , function (error, result) {
            
          });

        });

        
        // 카테고리 검색
        app.post("/search_category_token", bodyParser.json(), function(req, res){           
          var category = req.body.category;
          var sql = ""
          if(category == "all"){
            sql = 'select token_id from category';
          } else{
            sql = 'select token_id from category where category = ?';
          }

          connection.query(sql, [category] , function (error, result) {
            if(error){ console.log(error); }
            res.send(result)
            console.log(result)
          });
        });
        

      // input 검색
      app.post("/search_input_token", bodyParser.json(), function(req, res){           
        var search_type = req.body.search_type;
        var keyword = req.body.keyword;
        var sql = ""

        if(search_type == "키워드"){

          keyword = "%" + keyword + "%";
          sql = 'select token_id from category where description LIKE ? OR work_id LIKE ?';

          connection.query(sql, [keyword,keyword] , function (error, result) {
            if(error){ console.log(error); }
            res.send(result)
            console.log(result)
          });

        } else if (search_type == "작품아이디"){

          sql = 'select token_id from category where work_id = ?';

          connection.query(sql, [keyword] , function (error, result) {
            if(error){ console.log(error); }
            res.send(result)
            console.log(result)
          });

        } else if (search_type == "토큰아이디"){

          sql = 'select token_id from category where token_id = ?';

          connection.query(sql, [keyword] , function (error, result) {
            if(error){ console.log(error); }
            res.send(result)
            console.log(result)
          });

        } else if (search_type == "등록날짜"){

          sql = 'select token_id from category where regi_date = ?';
          
          connection.query(sql, [keyword] , function (error, result) {
            if(error){ console.log(error); }
            res.send(result)
            console.log(result)
          });
        }

       
      });



    }    
  }
}