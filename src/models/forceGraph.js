nv.models.forceGraph = function() {
  "use strict";
  
  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 0, right: 0, bottom: 0, left: 0}
    , width = 500
    , height = 500
    , noData = null
    , getTargets = function(d) { return d.targets; } //If going down the link only option, se will use these.
    , id = Math.floor(Math.random() * 10000) //Create semi-unique ID in case user doesn't select one
    , container = null
    , color = nv.utils.defaultColor()
    , showLegend = false
    , showControls = false
    , showLabels = true
    , duration = 500
    , label = function(d) { return d.name || JSON.stringify(d); }
    , draggable = true
    , linkDistance = 75
    , charge = -120
    , symbolSize = function(d) { return d.value || 6; }
    , linkStroke = "#888888"
    , linkStrokeWidth = function(d) { return d.weight || "2px"; }
    , selectionStrokeWidth = function(d) { return "2px"; }
    , selectionFill = "#99CCFF"
    , selectionStroke = "#6699EE"
    , symbolType= function(d) { return d.symbol ? d3.svg.symbolTypes[d.symbol] : "circle"; }
    , dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout', 'elementMousemove', 'renderEnd')
    , treeData = false //Should we consider the structure to be a tree?
    , onNodeSelectionChanged = undefined
    ;
  
  var renderWatch = nv.utils.renderWatch(dispatch);
  
  var force = d3.layout.force();

  //Was right above....
    
  function chart(selection) {
      renderWatch.reset();
      
      selection.each(function(data) {
        
        //Set up containers
        var availableWidth = width - margin.left - margin.right
            , availableHeight = height - margin.top - margin.bottom
            ;
        
        container = d3.select(this);
        
        nv.utils.initSVG(container);
        
        chart.update = function() { container.transition().duration(duration).call(chart); };
        
        var wrap = container.selectAll('.nv-wrap.nv-force').data([data]);
        var wrapEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-force nv-chart-' + id);
        var gEnter = wrapEnter.append('g');
        var g_force = gEnter.append('g').attr('class', 'nv-force');
        g_force = container.selectAll('.nv-wrap.nv-force.nv-force');
                     
        force = force.charge(charge)
          .linkDistance(linkDistance)
          .size([availableWidth, availableHeight]);
        
        if (!data || (data.nodes && data.nodes.length==0) || (data.links && data.links.length==0)) {
            nv.utils.noData(chart, container);
            renderWatch.renderEnd('force immediate');
            return chart;
        } else {
            container.selectAll('.nv-noData').remove();
        }
          
          
        //Either we have links AND nodes; or we have just links, or just nodes. We can handle any eventuality.
        if(treeData) {
          //TODO add a getChildren so one can customize that if one wants!
          throw "Tree data not done yet, TODO won't take long to do!";
        } else {
          if(data.nodes && data.links) { //Easy case
            force = force.nodes(data.nodes)
              .links(data.links);
          } else if(data.links) { //Just links
            data.nodes = [];
            var nodeSet = {};
            for(var i = data.links.length; i--;) {
              var s = data.links[i].source;
              var t = data.links[i].target;
              if(!nodeSet[JSON.stringify(s)]) {
                data.nodes.push(s);
                nodeSet[JSON.stringify(s)] = s;
              } else {
                data.links[i].source = nodeSet[JSON.stringify(s)];
              }
              if(!nodeSet[JSON.stringify(t)]) {
                data.nodes.push(t);
                nodeSet[JSON.stringify(t)] = t;
              } else {
                data.links[i].target = nodeSet[JSON.stringify(t)];
              }
            }
            force = force.nodes(data.nodes)
              .links(data.links);
          } else if(data.nodes) { //Just nodes. Note we don't handle indexed targets here, so this case is limited to users who don't have cyclical data!
            data.links = [];
            for(var i = data.nodes.length; i--;) {
              var n = data.nodes[i];
              var ts = getTargets(n);
              for(var j = ts.length; j--;) {
                data.links.push({source: n, target: ts[j]});
              }
            }
            force = force.nodes(data.nodes)
              .links(data.links);
          } else {
            console.log("Bad data! ", data);
            throw "Data needs either: .nodes, .links, both, -OR- treeData option is set and data has .children.";
          }
        }
         
        force.start();
                     
        var node, link, textLabel, brush;

	//TODO the brush style needs to be set dynamically
        var brush = g_force.append("g")
            .datum(function() { return {selected: false, previouslySelected: false}; })
            .attr("class", "selector-brush")
	    .style("fill", selectionFill)
	    .style("stroke", selectionStroke)
            .style("stroke-width", selectionStrokeWidth);
 
        //If a tree, we can make collapsible- cause update again on click!
                     //TODO
        var linkSelection = g_force.selectAll(".link")
                    .data(data.links);
        link = linkSelection.enter().append("line")
                    .attr("class", "link")
                    .style("stroke", linkStroke)
                    .style("stroke-width", linkStrokeWidth);
                    
        linkSelection.exit().remove();
        
        console.log("Selecting data.nodes on .node class!: ", data.nodes);
        
        var nodeSelection = g_force.selectAll(".node")
                      .data(data.nodes);
                      
        function clearSelection() {
	  for(var k = data.nodes.length; k--;) {
              data.nodes[k]._$selected = false;
	  }
	  nodeSelection.classed("selected-node", false);
	};
	
	function fireSelectionChanged() {
	  var selectedNodes = [];
          for(var k = data.nodes.length; k--;) {
		if (data.nodes[k]._$selected) {
			selectedNodes.push(data.nodes[k])
		}
	  }
	  if (onNodeSelectionChanged && selectedNodes.length != 0) {
		onNodeSelectionChanged(selectedNodes);
	  }
        };

          node = nodeSelection.enter().append("path")
                      .attr("class", "node")
		      .attr("d", d3.svg.symbol().type(symbolType).size(symbolSize))
                      .on("mouseover", function(d) {
			console.log(d);
                        d3.select(this).classed('selected-node', true);
                      })
                      .on("mouseout", function(d) {
                        d3.select(this).classed('selected-node', function(d) { return d._$selected; });
                      })
		      .on("dblclick", function(d) {
			//NICE TO HAVE: on double click, ensure any links and nodes that are invisible from it are visibled
			//And if selected, hide any links and nodes that are linked
                        clearSelection();
                        d._$selected = true;
                        d3.select(this).classed('selected-node', function(d) { return d._$selected; });
		 	fireSelectionChanged();
                      })
		      .on("click", function(d) {
			d._$selected = ! d._$selected;
                        d3.select(this).classed('selected-node', function(d) { return d._$selected; });
			fireSelectionChanged();
		      })
                      .style("fill", function(d, i) { return color(d, i); });
          //nodeSelection.transition().duration(duration).attr("r", symbolSize);
        
        brush.call(d3.svg.brush()
        .x(d3.scale.identity().domain([0, width]))
        .y(d3.scale.identity().domain([0, height]))
        .on("brushstart", function(d) {
          nodeSelection.each(function(d) { d._$previouslySelected = false && d._$selected; }); //The true was once whether the shift key was selected
        })
        .on("brush", function() {
          var extent = d3.event.target.extent();
          nodeSelection.classed("selected-node", function(d) {
            return d._$selected = d._$previouslySelected ^
                (extent[0][0] <= d.x && d.x < extent[1][0]
                && extent[0][1] <= d.y && d.y < extent[1][1]);
          });
        })
        .on("brushend", function() {
	  fireSelectionChanged();
          d3.event.target.clear();
          d3.select(this).call(d3.event.target);
        }));
         
        if(showLabels) {
          textLabel = g_force.selectAll(".label")
                      .data(data.nodes);
          textLabel.enter()
                   .append('text').attr("class", "label").style("font-weight", "bold")
                   .text(label);
          textLabel.transition().duration(duration).text(label);
        } else {
          //NOTE we still show on hover
          textLabel = node.append("title")
          .text(label);
        }
        
        nodeSelection.exit().remove();
                      
        if(draggable) {
          node.call(force.drag);
          textLabel.call(force.drag);
        }
        
                     
        force.on("tick", function() {
    
          g_force.selectAll(".link").attr("x1", function(d) { return d.source.x; })
              .attr("y1", function(d) { return d.source.y; })
              .attr("x2", function(d) { return d.target.x; })
              .attr("y2", function(d) { return d.target.y; });
         
          g_force.selectAll(".node").attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

          g_force.selectAll(".label").attr("x", function(d) { return d.x; })
            .attr("y", function(d) { return d.y; });
        });
        
        nodeSelection.exit().remove();
        
        
      });

    renderWatch.renderEnd('force immediate');

    return chart;
    
  }
  
  chart.dispatch = dispatch;
  chart.options = nv.utils.optionsFunc.bind(chart);
  
  chart._options = Object.create({}, {
    //simple options, get/set the necessary values
    width:      {get: function(){return width;}, set: function(_){width=_;}},
    height:     {get: function(){return height;}, set: function(_){height=_;}},
    margin:     {get: function(){return margin;}, set: function(_){margin=_;}},
    noData:     {get: function(){return noData;}, set: function(_){noData=_;}},
    targets:    {get: function(){return getTargets;}, set: function(_){getTargets=_;}},
    id:         {get: function(){return id;}, set: function(_){id=_;}},
    showLegend: {get: function(){return showLegend;}, set: function(_){showLegend=_;}},
    showLabels: {get: function(){return showLabels;}, set: function(_){showLabels=_;}},
    label:      {get: function(){return label;}, set: function(_){label=_;}},
    charge:     {get: function(){return charge;}, set: function(_){charge=_;}},
    duration:     {get: function(){return duration;}, set: function(_){duration=_;}},
    draggable:  {get: function(){return draggable;}, set: function(_){draggable=_;}},
    symbolSize:  {get: function(){return symbolSize;}, set: function(_){symbolSize=_;}},
    linkStroke:  {get: function(){return linkStroke;}, set: function(_){linkStroke=_;}},
    linkStrokeWidth:  {get: function(){return linkStrokeWidth;}, set: function(_){linkStrokeWidth=_;}},
    linkDistance: {get: function(){return linkDistance;}, set: function(_){linkDistance=_;}},
    selectionStroke: {get: function(){return selectionStroke;}, set: function(_){selectionStroke=_;}},
    selectionFill: {get: function(){return selectionFill;}, set: function(_){selectionFill=_;}},
    selectionStrokeWidth: {get: function(){return selectionStrokeWidth;}, set: function(_){selectionStrokeWidth=_;}},
    showControls: {get: function(){return showControls;}, set: function(_){showControls=_;}},
    treeData:   {get: function(){return treeData;}, set: function(_){treeData=_;}},
    onNodeSelectionChanged:   {get: function(){return onNodeSelectionChanged;}, set: function(_){onNodeSelectionChanged=_;}}, 
    symbolType:   {get: function(){return symbolType;}, set: function(_){symbolType=_;}}, 

    //Complex options
    color: {get: function(){return color;}, set: function(_){
            color=nv.utils.getColor(_);
        }},

  });
  
  nv.utils.initOptions(chart);
  return chart;
    
}

