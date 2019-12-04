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
        
        // 쪽지함 불러오기
        app.post("/test", bodyParser.json(), function(req, res){           
            var address = req.body.address;
            var sql = 'select sender, contents from note where receiver = ?';
	          connection.query(sql, [address] , function (error, result) {
                res.send(result)
                console.log(result)
            });
        });

        // 쪽지 보내기
        app.post("/send", bodyParser.json(), function(req, res){           
            var sender = req.body.sender;
            var receiver = req.body.receiver;
            var contents = req.body.contents;

            var sql = 'insert into note values(?,?,?)';
	          connection.query(sql, [sender,receiver,contents] , function (error, result) {
                res.send(result)
                console.log(result)
            });
        });

        // 검색기능
        app.post("/test2", function(req, res){           
          console.log("test");
      });

        

    }
  }
}