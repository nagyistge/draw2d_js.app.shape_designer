/*jshint sub:true*/

// declare the namespace for this example
var shape_designer = {
		figure:{
			
		},
		filter:{
			
		},
		dialog:{
			
		},
		policy:{
			
		},
		storage:{
			
		}
};

/**
 * 
 * The **GraphicalEditor** is responsible for layout and dialog handling.
 * 
 * @author Andreas Herz
 */

shape_designer.Application = Class.extend(
{
    NAME : "shape_designer.Application", 

    
    /**
     * @constructor
     * 
     * @param {String} canvasId the id of the DOM element to use as paint container
     */
    init : function()
    {
        var _this = this;

        this.documentConfigurationTempl = {
            baseClass:"draw2d.SetFigure",
            code :$("#shape-edit-template").text().trim()
        };

        this.localStorage = [];
        try {
            if( 'localStorage' in window && window.localStorage !== null){
                this.localStorage = localStorage;
            }
        } catch(e) {

        }

        this.currentFile = null;
        // attached to the very first shape
        this.documentConfiguration = $.extend({},this.documentConfigurationTempl);

        this.storage = new shape_designer.storage.BackendStorage();
        this.view    = new shape_designer.View(this, "canvas");
        this.toolbar = new shape_designer.Toolbar(this, "toolbar",  this.view );
        this.layer   = new shape_designer.Layer(this, "layer_elements", this.view );
        this.filter  = new shape_designer.FilterPane(this, "filter_actions", this.view );
        this.breadcrumb  = new shape_designer.Breadcrumb(this,"breadcrumb" );
        this.view.installEditPolicy(new shape_designer.policy.SelectionToolPolicy());

        // Get the authorization code from the url that was returned by GitHub
        var code = this.getParam("code");
        if (code!==null) {
           $.getJSON(conf.githubAuthenticateCallback+code, function(data) {
               _this.storage.connect(data.token, $.proxy(function(success){
                   _this.toolbar.onLogginStatusChanged(success);
               },this));
           });
        }
        about.hide();

        this.breadcrumb.update(this.storage);

        // check if the user has added a "file" parameter. In this case we load the shape from
        // the draw2d.shape github repository
        //
        var shapeUrl = "./assets/shapes/Basic.shape";
        var file = this.getParam("file");
        if(file){
            shapeUrl = conf.repository + file.replace(/_/g,"/");
            // cleaup the localStorage if the user comes with a fresh file request
            this.localStorage.removeItem("json");
        }

        // restore the previews document from asession before
        //
        if(this.localStorage["json"]) {
            _this.fileNew(this.localStorage["json"]);
        }
        // or load the requested document
        //
        else {
            $.getJSON(shapeUrl, function (document) {
                _this.fileNew(document);
            });
        }

        // save the document in the local storage if the user leave the page
        //
        window.onbeforeunload = function (e) {
            var writer = new draw2d.io.json.Writer();
            writer.marshal(_this.view, function (json, base64) {
                _this.localStorage["json"]=JSON.stringify(json);
            });
        };
    },

    login:function()
    {
        window.location.href='https://github.com/login/oauth/authorize?client_id='+conf.githubClientId+'&scope=public_repo';
    },

    getParam: function( name )
    {
      name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
      var regexS = "[\\?&]"+name+"=([^&#]*)";
      var regex = new RegExp( regexS );
      var results = regex.exec( window.location.href );
      if( results === null )
        return null;
      
      return results[1];
    },
 	
	fileNew: function(shapeTemplate)
    {
        this.view.clear();
        this.localStorage.removeItem("json");
        this.storage.currentFileHandle = null;
        this.documentConfiguration = $.extend({},this.documentConfigurationTempl);

        if(shapeTemplate){
            var reader = new draw2d.io.json.Reader();
            reader.unmarshal(this.view, shapeTemplate);
            this.view.getCommandStack().markSaveLocation();

            // get the bounding box of the document and translate the complete document
            // into the center of the canvas. Scroll to the top left corner after them
            //
            var xCoords = [];
            var yCoords = [];
            this.view.getFigures().each(function(i,f){
                var b = f.getBoundingBox();
                xCoords.push(b.x, b.x+b.w);
                yCoords.push(b.y, b.y+b.h);
            });
            var minX   = Math.min.apply(Math, xCoords);
            var minY   = Math.min.apply(Math, yCoords);
            var width  = Math.max.apply(Math, xCoords)-minX;
            var height = Math.max.apply(Math, yCoords)-minY;

            var dx = (this.view.getWidth()/2)-(minX+width/2);
            var dy = (this.view.getHeight()/2)-(minY+height/2);
            this.view.getFigures().each(function(i,f){
                f.translate(dx,dy);
            });
            this.view.getLines().each(function(i,f){
                f.translate(dx,dy);
            });

            // scroll the document top/left corner into the viewport
            //
            var c = $("#canvas");
            c.animate({ scrollTop: minY+dy-(c.height()/2), scrollLeft: minX+dx-(c.width()/2) });

        }
    },

    fileOpen: function()
    {
        this.fileNew();

        new shape_designer.dialog.FileOpen(this.storage).show(

            // success callback
            $.proxy(function(fileData){
                try{
                    this.view.clear();
                    var reader = new draw2d.io.json.Reader();
                    reader.unmarshal(this.view, fileData);
                    this.getConfiguration();
                    this.view.getCommandStack().markSaveLocation();
                    this.breadcrumb.update(this.storage);
                }
                catch(e){
                    this.view.reset();
                }
            },this));
    },

	fileSave: function()
    {
        this.setConfiguration();
        if(this.storage.currentFileHandle===null) {
            new shape_designer.dialog.FileSaveAs(this.storage).show(this.view);
        }
        else{
            new shape_designer.dialog.FileSave(this.storage).show(this.view);
        }
	},


    getConfiguration: function( key)
    {
        var figures = this.view.getExtFigures();
        if(figures.getSize()>0){
            this.documentConfiguration = $.extend({},  this.documentConfiguration, figures.first().getUserData());
        }

        if(key){
            return this.documentConfiguration[key];
        }
        return this.documentConfiguration;
    },

    setConfiguration: function(conf )
    {
        this.documentConfiguration = $.extend({},  this.documentConfiguration, conf);
        var figures = this.view.getExtFigures();
        if(figures.getSize()>0) {
            figures.first().setUserData( this.documentConfiguration);
        }
    }
});