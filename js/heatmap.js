var formatDecimal = d3.format(".2n");
var formatThousand = d3.format(",d");
var dataset;
var csvData;
var postingsArr = [];
var theTreeMap, theMap;
var rateByStateId, rateByMsaId;
var clickedId = 0;
var quantile, selectedVar;
var mapW;
var storedCxStSd, storedCxMsaSd, storedCxStLq, storedCxMsaLq;
var heatMap = function(opts) {

    this.geo = opts.geo;
    this.element = opts.element;
    this.view = opts.view;

    this.draw();
    this.setView();
    this.update();

}


heatMap.prototype.draw = function() {

    this.setDimensions();

    //this.element.innerHTML = "";
    this.svg = d3.select(this.element).append('svg');
    
    this.element.style.width = this.width;
    this.svg.attr('width', this.width);
    this.svg.attr('height', this.height);

    this.centered = null; //Store path data if map is zoomed to path
    this.isZoomed = false; //Store path data if map is zoomed to path
    this.maxZoom = 2.5; //Level to zoom into when area or region is clicked.
    this.lineStroke = 1; //Stroke width to maintain at various zoom levels.

    this.homeButton(); //Add a "reset map" button to the target element

    this.plot = this.svg.append('g')
        .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
        .attr("class", "map-g");

    //Append a background element
    this.plot.append("rect")
        .attr("class", "background")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", this.width)
        .attr("height", this.height)
        .on("click", function(d) {
            var el = this;
            if (_this.isZoomed) {
                _this.clicked(d, el);
            }
        });

    //Append the tooltip
    this.tooltipDiv = d3.select(this.element)
        .append("div")
        .attr("class", "tooltip");


    this.resetProjection();

    /* DRAW THE MAP FEATURES */
    var _this = this;

    /* ------------------- */
    /* STATES */
    /* ------------------- */

    var states = this.plot.append("g")
        .attr("class", "states-g");

    var paths = states.selectAll("path")
        .data(topojson.feature(this.geo, this.geo.objects.states).features)
        .enter().append("path")
        .attr("d", _this.path)
        .attr("class", "state feature")
        .attr('id', function(d) { return 'fips_' + d.id;});

    //SORTING PATHS TOP TO BOTTOM FOR THE TRANSITION EFFECT
    for(var i = 0; i < paths[0].length; i++){
        paths[0][i].__data__['centroidY'] = this.path.centroid(paths[0][i].__data__)[1];
    }
    paths.sort(function(a, b){ return d3.ascending(a.centroidY, b.centroidY); })




    /* ------------------- */
    /* MSAs */
    /* ------------------- */

    var msas = this.plot.append("g")
        .attr("class", "msas-g");

    var stateBckg = msas.selectAll("stateBckg")
        .data(topojson.feature(this.geo, this.geo.objects.states).features)
        .enter().append("path")
        .attr("d", _this.path)
        .attr("class", "stateBckg")
        .attr('id', function(d) { return 'bgfips_' + d.id;})
        .attr('fill', '#dddddd')
        .attr('stroke', '#fff');

    var couPaths = msas.selectAll("msa")
        .data(topojson.feature(this.geo, this.geo.objects.msa).features)
        .enter().append("path")
        .attr("d", _this.path)
        .attr("class", function(d) { 
            if(typeof dataset[d.properties.geoid] != 'undefined'){
                if(+dataset[d.properties.geoid][0].population < 250000){
                    return "msa feature small";
                }
                else if(+dataset[d.properties.geoid][0].population > 1000000){
                    return "msa feature large";
                }
                else return "msa feature medium";
                
            }
            
        })
        .attr('id', function(d) { return 'fips_' + d.properties.geoid;});


    //SORTING PATHS TOP TO BOTTOM FOR THE TRANSITION EFFECT
    for(var i = 0; i < couPaths[0].length; i++){
        couPaths[0][i].__data__['centroidY'] = this.path.centroid(couPaths[0][i].__data__)[1];
    }
    couPaths.sort(function(a, b){ return d3.ascending(a.centroidY, b.centroidY); })

    //Assign mouse events to all geographies
    this.setListeners();


}

heatMap.prototype.setListeners = function(){
    var _this = this;
    var features = this.plot.selectAll(".feature")
        .on("mouseover", function(d) {
            d3.select(this).classed("active", true).moveToFront();
            d3.select('#fips_' + clickedId).moveToFront();
            _this.tooltip(d);
            _this.tooltipDiv.style('display', 'inherit');


                
        })
        .on("mouseout", function(d) {
            d3.select(this).classed("active", false);
            _this.tooltipDiv.style('display', 'none');

        })
        .on("mousemove", function() {

            var bodyRect = document.body.getBoundingClientRect(),
                elemRect = _this.element.getBoundingClientRect(),
                offsetTop = elemRect.top - bodyRect.top,
                offsetLeft = elemRect.left - bodyRect.left;

            var xPos = d3.event.pageX - offsetLeft;
            var yPos = d3.event.pageY - offsetTop;

            var ttWidth = parseInt(_this.tooltipDiv.style("width").replace("px", ""), 10);
            var ttHeight = parseInt(_this.tooltipDiv.style("height").replace("px", ""), 10);

            var ttLeft = xPos - (ttWidth / 2);
            var ttTop = yPos - ttHeight - 30;

            var maxRight = _this.width - (ttWidth / 2);

            if (ttLeft + (ttWidth / 2) >= maxRight) {
                ttLeft = maxRight - (ttWidth / 2);
            }

            if (ttTop < 0) {
                ttTop = yPos + 30;
            }

            if (ttLeft < 0) {
                ttLeft = 0;
            }

            _this.tooltipDiv.style({
                "top": ttTop + "px",
                "left": ttLeft + "px"
            });
        })
        .on("click", function(d) {
            _this.tooltipDiv.style('display', 'none');
            var el = this;
            updateTable(d);
            _this.clicked(d, el);
        });
}

heatMap.prototype.setColor = function(val) {
    if (!val) {
        return this.colors.blank;
    }
}


heatMap.prototype.resetProjection = function() {
    if(mapW > 600){
        projectionRatio = 1;
    }
    else projectionRatio = 1.35;
    

    this.path = d3.geo.path();
    this.projection = d3.geo.albersUsa()
        .scale(this.width * projectionRatio)
        .translate([this.width / 2, this.height / 2]);

    this.path.projection(this.projection);
}


heatMap.prototype.setDimensions = function() {
    // define width, height and margin
    this.width = this.element.offsetWidth;
    if(mapW > 600){
        this.height = this.element.offsetWidth * .46;
    }
    else this.height = this.element.offsetWidth * .76;
    this.margin = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    };
    if(mapW < 600){
        this.margin.top = 25;
    }
}


//Set view as "states" or "msas"
heatMap.prototype.setView = function() {
    var states = this.plot.select(".states-g");
    var msas = this.plot.select(".msas-g");

    if (this.view === "states") {
        states.style("display", "inherit");
        msas.style("display", "none");
        d3.selectAll('.coun').style("display", "none");
        d3.selectAll('.st').style("display", "inherit");
        d3.select('#supply_demand_ratioSvg').select('.avLine').attr('x1', function(d) { return storedCxStSd(d.ratio);}).attr('x2', function(d) { return storedCxStSd(d.ratio);});
        d3.select('#supply_demand_ratioSvg').select('.avTxt').attr('x', function(d) { return storedCxStSd(d.ratio);});
        d3.select('#supply_demand_ratioSvg').select('.avNum').attr('x', function(d) { return storedCxStSd(d.ratio);});
        d3.select('#location_quotientSvg').select('.avLine').attr('x1', function(d) { return storedCxStLq(d.ratio);}).attr('x2', function(d) { return storedCxStLq(d.ratio);});
        d3.select('#location_quotientSvg').select('.avTxt').attr('x', function(d) { return storedCxStLq(d.ratio);});
        d3.select('#location_quotientSvg').select('.avNum').attr('x', function(d) { return storedCxStLq(d.ratio);});
        d3.selectAll('.legendTxt').text(function(d,i) {
            return setLegendLabel(d, i);
        });
        d3.select('#search').attr('placeholder', 'Search State');
        d3.select('.filterBtns').style('display', 'none');
        d3.selectAll('.noMsaR').style('display', 'none');
        d3.selectAll('.noMsaT').style('display', 'none');
    } else if (this.view === "msas") {
        states.style("display", "none");
        msas.style("display", "inherit");
        d3.selectAll('.coun').style("display", "inherit");
        d3.selectAll('.st').style("display", "none");
        d3.select('#supply_demand_ratioSvg').select('.avLine').attr('x1', function(d) { return storedCxMsaSd(d.ratio);}).attr('x2', function(d) { return storedCxMsaSd(d.ratio);});
        d3.select('#supply_demand_ratioSvg').select('.avTxt').attr('x', function(d) { return storedCxMsaSd(d.ratio);});
        d3.select('#supply_demand_ratioSvg').select('.avNum').attr('x', function(d) { return storedCxMsaSd(d.ratio);});
        d3.select('#location_quotientSvg').select('.avLine').attr('x1', function(d) { return storedCxMsaLq(d.ratio);}).attr('x2', function(d) { return storedCxMsaLq(d.ratio);});
        d3.select('#location_quotientSvg').select('.avTxt').attr('x', function(d) { return storedCxMsaLq(d.ratio);});
        d3.select('#location_quotientSvg').select('.avNum').attr('x', function(d) { return storedCxMsaLq(d.ratio);});
        d3.selectAll('.legendTxt').text(function(d,i) {
            return setLegendLabel(d, i);
        });
        d3.select('#search').attr('placeholder', 'Search Metro Area');
        d3.select('.filterBtns').style('display', 'inherit');
        d3.selectAll('.noMsaR').style('display', 'inherit');
        d3.selectAll('.noMsaT').style('display', 'inherit');
    }
}




heatMap.prototype.update = function() {

    this.setDimensions();

    //Update svg dimensions
    this.svg.attr('width', this.width);
    this.svg.attr('height', this.height);
    this.resetProjection();
    d3.selectAll('.state').attr("d", this.path);
    d3.selectAll('.msa').attr("d", this.path);
    d3.selectAll('.stateBckg').attr("d", this.path);
    d3.select('.leg').attr("transform", "translate(" + this.width/1.20 + "," + this.height/2.35 + ")");
    d3.select('.instr').attr('x', this.width/1.75)
        .attr('y', this.height*0.08)
}


heatMap.prototype.homeButton = function() {
    var _this = this;

    d3.select(this.element).append("button")
        .attr("class", "home-btn")
        .html("&minus; Zoom out")
        .on("click", function(d) {
            var el = this;
            if (_this.isZoomed) {
                _this.clicked(d, el);
            }
        })
}




//Zoom to center of selected feature when clicked
heatMap.prototype.clicked = function(d, el) {
    var x, y, k; //left, top, zoom
    d3.selectAll('.feature').style("stroke-width", 1 );
    var _this = this;
    if(typeof d != 'undefined' && d.id){
        if (d && _this.centered !== d) {
            _this.centered = d;
            _this.isZoomed = true;
            d3.selectAll('.feature').classed('clicked', false);
            d3.selectAll('.feature').classed('active', false);
            d3.select(el).moveToFront().classed("centered", true).classed('clicked', true).style("stroke-width", 3 );
            _this.isZoomed = true;
            clickedId = d.id;

        } else {
            
            _this.centered = null;
            _this.isZoomed = false;
            d3.select(el).classed("clicked", false);
            d3.selectAll('.feature').classed("clicked", false);
            _this.isZoomed = false;
            clickedId = 0;
            d3.select('.region').html('National level');
            drawOpenings(0);
            d3.selectAll('circle.ratioCirc').style('opacity', 0.5).attr('stroke', 'none');
            d3.selectAll('.ratioNumber').style('display', 'none');
            d3.selectAll('.ratioState').style('display', 'none');
            d3.selectAll('.cirG').select('rect').style('display', 'none');
            d3.select('#cf0').moveToFront().style('opacity', 1).attr('stroke', '#455A64').attr('stroke-width', '2px');
            d3.select('#tf0').style('display', 'inherit');
            d3.select('#tsf0').style('display', 'inherit');
            fillTopJobs(0);
            theTreeMap.updateTreemap(0);
            updateBars(0);
            d3.selectAll('.qualText').text('');
            d3.selectAll('.qualifiers').style('opacity', 0.4);
        }
    }
    else {
        if (d && _this.centered !== d) {
            var centroid = _this.path.centroid(d);
            x = centroid[0];
            y = centroid[1];
            k = _this.maxZoom;
            _this.centered = d;
            d3.selectAll('.feature').classed('clicked', false);
            d3.select(el).moveToFront().classed("centered", true).classed('clicked', true).style("stroke-width", 3 );
            _this.isZoomed = true;
            _this.view === "states" ? clickedId = d.id : clickedId = d.properties.geoid;
            d3.select(".home-btn").style("display", "inherit");
            _this.plot.selectAll(".feature:not(.clicked)")
                .transition()
                .duration(750).style("stroke-width", (_this.lineStroke/2 ));
            d3.select('.instruction').style('display', 'none');
            _this.plot.selectAll(".stateBckg").transition()
                .duration(750)
                .style("stroke-width", (_this.lineStroke/2 ));

        } else {
            x = _this.width / 2;
            y = (_this.height / 2) - _this.margin.top ;
            k = 1;
            _this.centered = null;
            d3.select(el).classed("centered", false);
            d3.selectAll('.feature').classed("clicked", false);
            _this.isZoomed = false;
            clickedId = 0;
            d3.select(".home-btn").style("display", "none");
            _this.setListeners();
            d3.select('.region').html('National level');
            drawOpenings(0);
            d3.selectAll('circle.ratioCirc').style('opacity', 0.5).attr('stroke', 'none');
            d3.selectAll('.ratioNumber').style('display', 'none');
            d3.selectAll('.ratioState').style('display', 'none');
            d3.selectAll('.cirG').select('rect').style('display', 'none');
            d3.select('#cf0').moveToFront().style('opacity', 1).attr('stroke', '#455A64').attr('stroke-width', '2px');
            d3.select('#tf0').style('display', 'inherit');
            d3.select('#tsf0').style('display', 'inherit');
            fillTopJobs(0);
            theTreeMap.updateTreemap(0);
            updateBars(0);
            d3.select('.instruction').style('display', 'block');
            d3.selectAll('.qualText').text('');
            d3.selectAll('.qualifiers').style('opacity', 0.4);
            _this.plot.selectAll(".feature").transition()
                .duration(750)
                .style("stroke-width", (_this.lineStroke ));
            _this.plot.selectAll(".stateBckg").transition()
                .duration(750)
                .style("stroke-width", (_this.lineStroke ));
        }

        _this.plot.classed("zoomed", _this.isZoomed);
        _this.zoomScale(k, x, y);
    }

}

heatMap.prototype.zoomScale = function(k, x, y) {
    console.log(y);
    var _this = this;
    _this.plot.transition()
        .duration(750)
        .attr("transform", "translate(" + (_this.width / 2) + "," + (_this.height / 2) + ")scale(" + k + ")translate(" + -x + "," + -y + ")")

}




heatMap.prototype.tooltip = function(d) {
    var txt;
    var elem = document.getElementById("drpdn");
    var selectedVarName = elem.options[elem.selectedIndex].text;

    selectedVar = elem.options[elem.selectedIndex].value;
    if (this.view === "states") {
        var formatedValue;
        if(selectedVar == 'total_postings' || selectedVar == 'total_supply'){ 
            formatedValue = formatThousand(+dataset[d.id][0][selectedVar]);
        }
        else formatedValue = formatDecimal(+dataset[d.id][0][selectedVar]);
        txt = "<div class=\"tipStateName\"> " + d.properties.state + "</div>";
        txt += "<div class=\"tipVarName\"> " + selectedVarName + "</div>";
        txt += "<div class=\"tipVar\"> " + formatedValue + "</div>";
        /*var num = dataset[d.id][0][selectedVar];

        num % 1 != 0 ? txt += "<div class=\"tipVar\"> " + num + "</div>" :
            txt += "<div class=\"tipVar\"> " + formatDecimal(num) + "</div>" */
    } else if (this.view === "msas") {
        var formatedValue;
        if(selectedVar == 'total_postings' || selectedVar == 'total_supply'){ 
            formatedValue = formatThousand(+dataset[d.properties.geoid][0][selectedVar]);
        }
        else formatedValue = formatDecimal(+dataset[d.properties.geoid][0][selectedVar]);
        txt = "<div class=\"tipStateName\"> " + d.properties.NAME + "</div>";
        txt += "<div class=\"tipVarName\"> " + selectedVarName + "</div>";
        txt += "<div class=\"tipVar\"> " + formatedValue + "</div>";
        txt += "<div class='more'>&#9432; Click for more info</div>";
    }

    d3.select(".tooltip").html(txt);

}

heatMap.prototype.reDraw = function() {
    var _this = this;
    //var reQuantile = d3.scale.quantile().range(colorbrewer.PuBu["7"]);
    switch (selectedVar) {
        case 'total_postings':
            quantile.range(colorbrewer.PuBu["7"]);
            break;
        case 'total_supply':
            quantile.range(['#fef0d9','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#990000']);
            break;
        case 'supply_demand_ratio':
            quantile.range(['#2166ac','#5586bd','#7fa7cf','#fef0d9','#faa078','#d75231','#990000']);
            break;
        case 'location_quotient':
            quantile.range(colorbrewer.BuPu["5"]);
    }

    csvData.forEach(function(d) { 
        if(d.fips.toString().length < 3 && d.fips != 0){
            rateByStateId.set(+d.fips, +d[selectedVar]);
        }
        else if(d.fips.toString().length > 3 && d.fips != 0) {
            rateByMsaId.set(+d.fips, +d[selectedVar]);
        }
    });
    var domAr = [0, 0.67, 0.83, 1.2, 1.5, 8];

    d3.selectAll('.feature').transition().duration(500).delay(function(d,i){ return _this.view == 'msas' ? i*1 : i*5;}).attr('fill', function(d) { 
        if(d.id){ 
            if(selectedVar == 'supply_demand_ratio'){
                var filtered = rateByStateId.values().filter(isBigEnough(1.01));                    
                quantile.domain(filtered);
                var domainArr = [0, 0.5, 0.99, 1, quantile.invertExtent((quantile.range()[4]))[0], quantile.invertExtent((quantile.range()[5]))[0], quantile.invertExtent((quantile.range()[6]))[1]];
                quantile.domain(domainArr);
                return quantile(rateByStateId.get(d.id));
                 
            }
            else if(selectedVar == 'location_quotient'){
                //Manual breaks for the map
                
                quantile.domain(domAr);
                return quantile(rateByStateId.get(d.id));
            }
            else {
                quantile.domain(rateByStateId.values()); 
                return quantile(rateByStateId.get(d.id));
            }
        }
        else { 
            if(typeof d.properties != 'undefined'){
                if(selectedVar == 'supply_demand_ratio'){
                    var filtered = rateByMsaId.values().filter(isBigEnough(1.01));                    
                    quantile.domain(filtered);
                    var domainArr = [0, 0.5, 0.99, 1, quantile.invertExtent((quantile.range()[4]))[0], quantile.invertExtent((quantile.range()[5]))[0], quantile.invertExtent((quantile.range()[6]))[1]];
                    quantile.domain(domainArr);
                    return quantile(rateByMsaId.get(d.properties.geoid));
                    
                }
                else if(selectedVar == 'location_quotient'){
                    //Natural breaks for the map
                    
                    quantile.domain(domAr);
                    return quantile(rateByMsaId.get(d.properties.geoid));
                }
                else {
                    quantile.domain(rateByMsaId.values());
                    return quantile(rateByMsaId.get(d.properties.geoid)); 
                }
            }
            else { return '#333';} 
        } 
    });
    //Redraw Map Legend
    d3.select('.leg').remove();
    drawLegend();

    var elem = document.getElementById("drpdn");
    var selectedTitle = elem.options[elem.selectedIndex].text;

    d3.select('.legendVar').text(selectedTitle);
}

function updateTable(d){
    d3.selectAll('circle.ratioCirc').style('opacity', 0.5).attr('stroke', 'none');
    d3.selectAll('.ratioNumber').style('display', 'none');
    d3.selectAll('.ratioState').style('display', 'none');
    if(d.id){ 
        d3.select('.region').html(d.properties.state);
        drawOpenings(d.id);
        d3.selectAll('.cirG').select('rect').style('display', 'none');
        d3.select('#supply_demand_ratioSvg').select('#cf' + d.id).moveToFront().style('opacity', 1).attr('stroke', '#455A64').attr('stroke-width', '2px');
        d3.select('#supply_demand_ratioSvg').select('#tf' + d.id).style('display', 'inherit');
        d3.select('#supply_demand_ratioSvg').select('#bg' + d.id).style('display', 'inherit');
        d3.select('#supply_demand_ratioSvg').select('#tsf' + d.id).style('display', 'inherit');
        d3.select('#location_quotientSvg').select('#cf' + d.id).moveToFront().style('opacity', 1).attr('stroke', '#455A64').attr('stroke-width', '2px');
        d3.select('#location_quotientSvg').select('#tf' + d.id).style('display', 'inherit');
        d3.select('#location_quotientSvg').select('#bg' + d.id).style('display', 'inherit');
        d3.select('#location_quotientSvg').select('#tsf' + d.id).style('display', 'inherit');
        fillQuotient(d.id, 'supply_demand_qualifier');
        fillQuotient(d.id, 'location_quotient_qualifier');
        fillTopJobs(d.id);
        theTreeMap.updateTreemap(d.id);
        updateBars(d.id);
    }
    else { 
        d3.select('.region').html(d.properties.NAME);
        drawOpenings(d.properties.geoid);
        d3.selectAll('.cirG').select('rect').style('display', 'none');
        d3.select('#supply_demand_ratioSvg').select('#cf' + d.properties.geoid).moveToFront().style('opacity', 1).attr('stroke', '#455A64').attr('stroke-width', '2px');
        d3.select('#supply_demand_ratioSvg').select('#tf' + d.properties.geoid).style('display', 'inherit');
        d3.select('#supply_demand_ratioSvg').select('#bg' + d.properties.geoid).style('display', 'inherit');
        d3.select('#supply_demand_ratioSvg').select('#tsf' + d.properties.geoid).style('display', 'inherit');
        d3.select('#location_quotientSvg').select('#cf' + d.properties.geoid).moveToFront().style('opacity', 1).attr('stroke', '#455A64').attr('stroke-width', '2px');
        d3.select('#location_quotientSvg').select('#tf' + d.properties.geoid).style('display', 'inherit');
        d3.select('#location_quotientSvg').select('#bg' + d.properties.geoid).style('display', 'inherit');
        d3.select('#location_quotientSvg').select('#tsf' + d.properties.geoid).style('display', 'inherit');
        fillQuotient(d.properties.geoid, 'supply_demand_qualifier');
        fillQuotient(d.properties.geoid, 'location_quotient_qualifier');
        fillTopJobs(d.properties.geoid);
        theTreeMap.updateTreemap(d.properties.geoid);
        updateBars(d.properties.geoid);
    }
}


function init() {
    rateByStateId = d3.map();
    rateByMsaId = d3.map();
    quantile = d3.scale.quantile()
        .range(colorbrewer.PuBu["7"]);


    
    queue()
        .defer(d3.json, "data/us_states_msa.json")
        .defer(d3.csv, "data/data.csv")
        .await(ready);

    function ready(error, us, csvd) {
        mapW = parseInt(d3.select('.map').style('width'));
        csvData = csvd;
        //Parse data for choropleth
        csvData.forEach(function(d) { 
            if(d.fips.toString().length < 3 && d.fips != 0){
                rateByStateId.set(+d.fips, +d.total_postings);
            }
            else if(d.fips.toString().length > 3 && d.fips != 0) {
                rateByMsaId.set(+d.fips, +d.total_postings);
            }
        });
        
        //Nest general dataset
        dataset = d3.nest()
          .key(function(d) { return d.fips; })
          .map(csvData);

        csvData.forEach(function(d){ 
            if(d.fips!=="0") {
                postingsArr.push(+d.total_postings); postingsArr.push(+d.total_supply);
            }});

        theTreeMap = new treeMap({
            element: document.querySelector('.treemap'),
            fips: 0,
            treeMapData: {
                'name': 'Postings by NICE Framework Area',
                'children': [
                {   'defs': "Specialty Areas responsible for providing the support, administration, and maintenance necessary to ensure effective and efficient information technology (IT) system performance and security.",
                    'name': 'Operate & Maintain',
                    'size': +dataset[0][0].operate_maintain
                },
                {   'defs': "Specialty Areas responsible for conceptualizing, designing, and building secure information technology (IT) systems, with responsibility for some aspect of the systems' development.",
                    'name': 'Securely Provision',
                    'size': +dataset[0][0].securely_provision
                },
                {   'defs': "Specialty Areas responsible for providing leadership, management, direction, or development and advocacy so the organization may effectively conduct cybersecurity work.",
                    'name': 'Oversee & Govern',
                    'size': +dataset[0][0].oversight_development
                },
                {   'defs': "Specialty Areas responsible for specialized denial and deception operations and collection of cybersecurity information that may be used to develop intelligence.",
                    'name': 'Collect & Operate',
                    'size': +dataset[0][0].collect_operate
                },
                {   'defs': "Specialty Areas responsible for highly specialized review and evaluation of incoming cybersecurity information to determine its usefulness for intelligence.",
                    'name': 'Analyze',
                    'size': +dataset[0][0].analyze
                },
                {   'defs': "Specialty Areas responsible for identifying, analyzing, and mitigating threats to internal information technology (IT) systems or networks.",
                    'name': 'Protect & Defend',
                    'size': +dataset[0][0].protect_defend
                },
                {   'defs': "Specialty Areas responsible for investigating cyber events or crimes related to information technology (IT) systems, networks, and digital evidence.",
                    'name': 'Investigate',
                    'size': +dataset[0][0].investigate
                }

            ]}
        })
        
        theMap = new heatMap({
            element: document.querySelector('.map'),
            geo: us,
            view: "states"
        });

        var stateSearch;

        d3.selectAll("input.btn")
            .on("click", function() {
                theMap.view = d3.select(this).attr("val");
                theMap.setView();
                choices = d3.select(this).attr("val");
                changeSearch(choices);
            });

        d3.select('.map').on('click', function(){
            document.getElementById('search').value = "";
        })


        d3.select(window).on('resize', function() {
            theMap.update();
            mapW = parseInt(d3.select('.map').style('width'));

            if(mapW < 600){
                d3.select('.leg').remove();
                drawLegend();
                d3.select('.instruction').remove();
            }
            else if(mapW > 600){
                d3.select('.leg').remove();
                drawLegend();
            }
        });

        d3.selectAll('.feature').attr('fill', function(d) { 
            if(d.id){ 
                quantile.domain(rateByStateId.values()); 
                return quantile(rateByStateId.get(d.id)); }
            else { 
                if(typeof d.properties != 'undefined'){
                    quantile.domain(rateByMsaId.values());
                    return quantile(rateByMsaId.get(d.properties.geoid)); 
                }
                else { return '#333';} 
            } 
        });

        theMap.svg.append("text")
            .attr('class', 'instruction')
            .attr('x', theMap.width/1.75)
            .attr('y', theMap.height*0.08)
            .text(function() { return mapW > 600 ? 'Click on a state or MSA for more info' : '';});

        

        //MAP LEGEND
        drawLegend();
        
        //INIT TABLE CHARTS
        drawOpenings(0);
        drawRatioChart('supply_demand_ratio', '.no2');
        drawRatioChart('location_quotient', '.no3');
        drawQualifier(['#5586bd','#7fa7cf','#fef0d9','#d75231','#990000'], 'supply_demand_qualifier');
        drawQualifier(colorbrewer.BuPu["5"], 'location_quotient_qualifier');
        fillTopJobs(0);
        createBars();
        updateBars(0);
        changeSearch('states');
        theMap.setView();

        //SEARCH FUNCTIONALITY
        var states = [];
        var msas = [];
        var fips = [];
        csvData.forEach(function(d){ 
            if(d.fips !== "0" && d.fips.toString().length < 3) {
                fips.push(d.fips);
            }
            if(d.fips!=="0" && d.msa != ''){
                msas.push(d.msa);
            }
        });

        for (var i = 0; i < fips.length; i++){
            var stat = us.objects.states.geometries.filter(function( obj ) {
                          return obj.id == fips[i];
                        });
            if(states.indexOf(stat[0].properties.state) == -1){
                  states.push(stat[0].properties.state);
            }
        }
        

        function changeSearch(selectedChoice){
            if(typeof stateSearch != 'undefined'){
                stateSearch.destroy();   
            }
            stateSearch = new autoComplete({
                selector: '#search',
                minChars: 0,
                source: function(term, suggest){
                    term = term.toLowerCase();
                    var choices;
                    selectedChoice == 'states' ? choices = states : choices = msas;
                    var suggestions = [];
                    for (i=0;i<choices.length;i++)
                        if (~choices[i].toLowerCase().indexOf(term)) suggestions.push(choices[i]);
                    suggest(suggestions);
                },
                onSelect: function(e, term, item){
                    //console.log(us.objects.states.geometries);
                    var selectedFips, d, selEl;
                    if(selectedChoice == 'states'){
                        selectedFips = us.objects.states.geometries.filter(function( obj ) {
                          return obj.properties.state == term;
                        });
                        d = d3.select('#fips_' + selectedFips[0].id)[0][0].__data__;
                        selEl = document.getElementById('fips_' + selectedFips[0].id);
                    }
                    else {
                        
                        selectedFips = csvData.filter(function( obj ) {
                          return obj.msa == term;
                        });
                        selEl = document.getElementById('fips_' + selectedFips[0].fips);
                        d = d3.select('#fips_' + selectedFips[0].fips)[0][0].__data__;
                    }
                    updateTable(d);
                    theMap.clicked(d, selEl);
                }
            });
            
        }

        new ShareButton({networks: {
            email: {
                enabled: false
            }
        }});

        //DROPDOWN MENU
        var elem = document.getElementById("drpdn");
        elem.onchange = function(){
            var selectedString = elem.options[elem.selectedIndex].value;
            selectedVar = selectedString;
            theMap.reDraw();
        }


        var selectedFilter;
        //FILTER BUTTONS
        d3.selectAll('.filter')
            .on('click', function(d){
                d3.select('#all').classed('pressed') == true ? d3.selectAll('.msa').style('display', 'none') : '';
                if(d3.select(this).text() != 'All'){
                    if(d3.select(this).classed('pressed')){
                        d3.select(this).classed('pressed', false);
                        d3.selectAll('.' + d3.select(this).text().toLowerCase()).style('display', 'none');
                    }
                    else{
                        d3.select('#all').classed('pressed', false);
                        d3.select(this).classed('pressed', true);
                        d3.selectAll('.' + d3.select(this).text().toLowerCase()).style('display', 'inherit');
                    }
                }
                else{
                    d3.selectAll('.filter').classed('pressed', false);
                    d3.select('#all').classed('pressed', true);
                    d3.selectAll('.msa').style('display', 'inherit');
                }
                /*if(selectedFilter != d3.select(this).text()){
                    d3.selectAll('.filter').classed('pressed', false);
                    d3.selectAll('.msa').style('display', 'none');
                    d3.selectAll('.' + d3.select(this).text().toLowerCase()).style('display', 'inherit');
                    d3.select(this).classed('pressed', true);
                    selectedFilter = d3.select(this).text();
                }
                else{
                    d3.selectAll('.filter').classed('pressed', false);
                    d3.selectAll('.msa').style('display', 'inherit');
                    selectedFilter = '';
                }*/
                
                //console.log(('.' + d3.select(this).text()));
            });

        d3.selectAll('.infIcon')
            .on('click', function(d){
                d3.select('#b' + d3.select(this).attr('rel')).style('display', 'inherit');
            })

        d3.selectAll('.closeBtn')
            .on('click', function(d){
                d3.select('#b' + d3.select(this).attr('rel')).style('display', 'none');
            })

    };

}

init();


function setLegendLabel(d, i){
    var domAr = [0, 0.67, 0.83, 1.2, 1.5, 8];
    if(theMap.view == 'states'){
        var filtered = rateByStateId.values().filter(isBigEnough(1.01));                    
        quantile.domain(filtered);
        var domainArr = [0, 0.5, 0.99, 1, quantile.invertExtent((quantile.range()[4]))[0], quantile.invertExtent((quantile.range()[5]))[0], quantile.invertExtent((quantile.range()[6]))[1]];
        if(selectedVar == 'location_quotient'){
            //Manual BREAKS MAP CLASS
            quantile.domain(domAr);
        }
        else if(selectedVar == 'supply_demand_ratio'){
            quantile.domain(domainArr);
        }
        else quantile.domain(rateByStateId.values());

        var extent = quantile.invertExtent(d);
        var format = d3.format(",.0f");
        var formatK = d3.format("s");
        var formatDec = d3.format(".3n");
        var format2Dec = d3.format(".2n");
        var forma = d3.format("");
        if(selectedVar == 'total_postings' || selectedVar == 'total_supply'){
            if(mapW > 600){
                return i != 0 ? format(+extent[0] + 1) + ' - ' + format(+extent[1]) : format(+extent[0]) + ' - ' + format(+extent[1]);
            }
            else return i != 0 ? formatK(Math.round(+extent[0]/100)*100) : '';
        }
        else if(selectedVar == 'location_quotient'){
            if(mapW > 600){
                if(i != 4){
                    return i != 0 ? forma(+extent[0] + 0.01) + ' - ' + forma(+extent[1]) : forma(+extent[0]) + ' - ' + forma(+extent[1]);
                }
                else return forma(+extent[0] + 0.01) + ' + ';
            }
            else return i != 0 ? forma(+extent[0]) : '';
        }
        else {
            if(mapW > 600){
                return i != 0 ? formatDec(+extent[0] + 0.05) + ' - ' + formatDec(+extent[1]) : formatDec(+extent[0]) + ' - ' + formatDec(+extent[1]);
            }
            else return i != 0 ? format2Dec(+extent[0] + 0.05) : '';
        }
    }
    else {
        var filtered = rateByMsaId.values().filter(isBigEnough(1.01));                    
        quantile.domain(filtered);
        var domainArr = [0, 0.5, 0.99, 1, quantile.invertExtent((quantile.range()[4]))[0], quantile.invertExtent((quantile.range()[5]))[0], quantile.invertExtent((quantile.range()[6]))[1]];
        if(selectedVar == 'location_quotient'){
            //Manual breaks for the map
            quantile.domain(domAr);
        }
        else if(selectedVar == 'supply_demand_ratio'){
            quantile.domain(domainArr);
        }
        else quantile.domain(rateByMsaId.values());

        var extent = quantile.invertExtent(d);
        var format = d3.format(",.0f");
        var formatDec = d3.format(".3n");
        var formatK = d3.format("s");
        var format2Dec = d3.format(".2n");
        var forma = d3.format("");
        if(selectedVar == 'total_postings' || selectedVar == 'total_supply'){
            if(mapW > 600){
                return i != 0 ? format(+extent[0] + 1) + ' - ' + format(+extent[1]) : format(+extent[0]) + ' - ' + format(+extent[1]);
            }
            else return i != 0 ? formatK(Math.round(+extent[0])) : '';
        }
        else if(selectedVar == 'location_quotient'){
            if(mapW > 600){
                if(i != 4){
                    return i != 0 ? forma(+extent[0] + 0.01) + ' - ' + forma(+extent[1]) : forma(+extent[0]) + ' - ' + forma(+extent[1]);
                }
                else return forma(+extent[0] + 0.01) + ' + ';
            }
            else return i != 0 ? forma(+extent[0]) : '';
        }
         else {
            if(mapW > 600){
                return i != 0 ? formatDec(+extent[0] + 0.05) + ' - ' + formatDec(+extent[1]) : formatDec(+extent[0]) + ' - ' + formatDec(+extent[1]);
            }
            else return i != 0 ? format2Dec(+extent[0] + 0.05) : '';
        }
    }
}

 /* -------------------------- */
/* FUNCTIONS DRAWING THE TABLE */
/* --------------------------- */


function drawOpenings(fips){
    
    var w = d3.scale.linear().domain([0, d3.max(postingsArr)]).range(["1%", "100%"]);
    if(fips == 0){
        w = d3.scale.linear().domain([0, Math.max(dataset[fips][0].total_postings, dataset[fips][0].total_supply)]).range(["0%", "100%"]);
    }
    d3.select('.openingsNumber').html(formatThousand(dataset[fips][0].total_postings));
    d3.select('.supplyNumber').html(formatThousand(dataset[fips][0].total_supply));
    d3.select('.openingsBar').transition().styleTween('width', function () {
        var from = this.style.width, // 10% 
            to = w(dataset[fips][0].total_postings); //85%
        return d3.interpolateString(from, to);
    });
    d3.select('.supplyBar').transition().styleTween('width', function () {
        var from = this.style.width, // 10% 
            to = w(dataset[fips][0].total_supply); //85%
        return d3.interpolateString(from, to);
    });

}

function drawRatioChart(variab, container){
    var holders;
    var locQuotByStateId = d3.map();
    var locQuotByMsaId = d3.map();
    var supDemByStateId = d3.map();
    var supDemByMsaId = d3.map();
    csvData.forEach(function(d) { 
        if(d.fips.toString().length < 3){
            locQuotByStateId.set(+d.fips, +d[variab]);
            supDemByStateId.set(+d.fips, +d[variab]);
        }
        else if(d.fips.toString().length > 3) {
            locQuotByMsaId.set(+d.fips, +d[variab]);
            supDemByMsaId.set(+d.fips, +d[variab]);
        }
    });

    var ratioData = [];
    var ratioNational = [];
    csvData.forEach(function(d){ 
        var regObj = {};
        regObj["fips"] = +d.fips;
        regObj["ratio"] = +d[variab];
        regObj["state"] = d.state;
        regObj["msa"] = d.msa;
        if(regObj["fips"] == 0){
            ratioNational.push(regObj);
        }
        else ratioData.push(regObj);
    })

    var margin = {top: 0, right: 10, bottom: 0, left: 0},
        width = d3.select(container).select('.boxContent').node().getBoundingClientRect().width-(margin.left+margin.right),
        height = 150;

    var cxState = d3.scale.log().range([20, width - 20]);
    var cxMsa = d3.scale.log().range([20, width - 20]);

    if(variab == 'supply_demand_ratio'){
        cxState.domain([0.9, d3.max(ratioData, function(d){ 
            if(d.fips.toString().length < 3){
                return d.ratio; 
            }
        })]);

        cxMsa.domain([0.6, d3.max(ratioData, function(d){ 
            if(d.fips.toString().length > 3){
                return d.ratio; 
            }
        })])

        storedCxStSd = cxState;
        storedCxMsaSd = cxMsa;
    }
    else{
        cxState.domain([0.1, d3.max(ratioData, function(d){ 
            if(d.fips.toString().length < 3){
                return d.ratio; 
            }
        })]);

        cxMsa.domain([0.1, d3.max(ratioData, function(d){ 
            if(d.fips.toString().length > 3){
                return d.ratio; 
            }
        })])
        storedCxStLq = cxState;
        storedCxMsaLq = cxMsa;
    }


    if(variab == 'supply_demand_ratio'){
        
        
    }

    var svg = d3.select('#' + variab + 'Chart').append('svg').attr('id', variab + 'Svg').attr('width', width).attr('height', height);

    svg.append('line')
        .style("stroke", '#CFD8DC')
        .attr("x1", 0)
        .attr("y1", 60)
        .attr("x2", width) 
        .attr("y2", 60);

    var aver = svg.selectAll('.' + variab + '_average')
        .data(ratioNational)
        .enter().append('line')
        .attr('class', 'avLine')
        .attr('x1', function(d) { return d.fips.toString().length > 3 ? cxMsa(d.ratio) : cxState(d.ratio);})
        .attr('x2', function(d) { return d.fips.toString().length > 3 ? cxMsa(d.ratio) : cxState(d.ratio);})
        .attr('y1', 30)
        .attr('y2', 90)
        .attr('stroke', '#b2c0c6');

    svg.selectAll('.' + variab + '_averTxt')
        .data(ratioNational)
        .enter().append('text')
        .attr('class', 'avTxt')
        .attr('x', function(d) { return d.fips.toString().length > 3 ? cxMsa(d.ratio) : cxState(d.ratio);})
        .attr('y', 105)
        .attr('class', 'averState')
        .attr('text-anchor', 'middle')
        .text('National average');

    svg.selectAll('.' + variab + '_averNum')
        .data(ratioNational)
        .enter().append('text')
        .attr('class', 'avNum')
        .attr('x', function(d) { return d.fips.toString().length > 3 ? cxMsa(d.ratio) : cxState(d.ratio);})
        .attr('y', 133)
        .attr('class', 'averNumber')
        .attr('text-anchor', 'middle')
        .text(function(d){ return formatDecimal(d.ratio); });

    var circles = svg.selectAll("circles")
        .data(ratioData)
        .enter()
        .append('circle')
        .attr('id', function(d){ return 'cf' + d.fips; })
        .attr('class', function(d){ return d.fips.toString().length > 3 ? variab + ' ratioCirc coun' : variab + ' ratioCirc st'})
        .attr('cy', 60)
        .attr('r', 15)
        .attr('cx', function(d) { 
            if(d.ratio != 0){
                return d.fips.toString().length > 3 ? cxMsa(d.ratio) : cxState(d.ratio);
            }
            else return -1000;
        })
        .attr('fill', function(d) { 
            var domAr = [0, 0.67, 0.83, 1.2, 1.5, 8];
            var quan = d3.scale.quantile()
                .range(colorbrewer.BuPu["5"]);

            var quanSupDem = d3.scale.quantile()
                .range(['#2166ac','#5586bd','#7fa7cf','#fef0d9','#faa078','#d75231','#990000']);
            
                //.domain(ratioData.map(function(d) { return d.ratio; }));
            if(variab == 'supply_demand_ratio'){
                if(d.fips.toString().length < 3){
                    var filtered = supDemByStateId.values().filter(isBigEnough(1.01));                    
                    quanSupDem.domain(filtered);
                    var domainArr = [0, 0.5, 0.99, 1, quanSupDem.invertExtent((quanSupDem.range()[4]))[0], quanSupDem.invertExtent((quanSupDem.range()[5]))[0], quanSupDem.invertExtent((quanSupDem.range()[6]))[1]];
                    quanSupDem.domain(domainArr);
                    return quanSupDem(supDemByStateId.get(d.fips));
                }
                else {
                    var filtered = supDemByMsaId.values().filter(isBigEnough(1.01));                    
                    quanSupDem.domain(filtered);
                    var domainArr = [0, 0.5, 0.99, 1, quanSupDem.invertExtent((quanSupDem.range()[4]))[0], quanSupDem.invertExtent((quanSupDem.range()[5]))[0], quanSupDem.invertExtent((quanSupDem.range()[6]))[1]];
                    quanSupDem.domain(domainArr);
                    return quanSupDem(supDemByMsaId.get(d.fips));
                }
                //return d.fips != 0 ? d3.select('path#fips_' + d.fips).attr('fill') : '#034e7b';
            }
            else {
                if(d.fips.toString().length < 3){
                    //quan.domain(locQuotByStateId.values());
                    //var breaks = ss.jenks(locQuotByStateId.values(), 5);
                    
                    quan.domain(domAr);
                    return quan(locQuotByStateId.get(d.fips));
                }
                else {
                    //quan.domain(locQuotByMsaId.values());
                    //var breaks = ss.jenks(locQuotByMsaId.values(), 5);
                    quan.domain(domAr);
                    return quan(locQuotByMsaId.get(d.fips));
                }
            }
        })
        .on('mouseover', function(d){
            d3.select('#' + variab + 'Svg').selectAll('circle').style('fill', '#eaeaea');
            d3.select(this).moveToFront().attr('stroke', '#455A64').attr('fill', d3.select(this).attr('fill')).style('fill', '').attr('stroke-width', '2px').style('opacity', 1);
            d3.select('#' + variab + 'Svg').select('#tf' + d.fips).moveToFront().style('display', 'inherit');
            d3.select('#' + variab + 'Svg').select('#bg' + d.fips).style('display', 'inherit');
            d3.select('#' + variab + 'Svg').select('#tsf' + d.fips).moveToFront().style('display', 'inherit');
            d3.select('path#fips_' + d.fips).classed("active", true).moveToFront();
            d3.select('#' + variab + 'Svg').select('#tf' + clickedId).style('display', 'none');
            d3.select('#' + variab + 'Svg').select('#bg' + clickedId).style('display', 'none');
            d3.select('#' + variab + 'Svg').select('#tsf' + clickedId).style('display', 'none');
        })
        .on('mouseout', function(d){
            d3.select('#' + variab + 'Svg').selectAll('circle').style('fill', '');
            d3.selectAll('.feature').classed("active", false);
            d3.select('path#fips_' + clickedId).classed("active", true).moveToFront();
            d3.select(this).moveToBack().attr('stroke', 'none').style('opacity', 0.5);
            d3.select('#' + variab + 'Svg').select('#tf' + d.fips).style('display', 'none'); 
            d3.select('#' + variab + 'Svg').select('#bg' + d.fips).style('display', 'none'); 
            d3.select('#' + variab + 'Svg').select('#tsf' + d.fips).style('display', 'none');
            d3.select('#' + variab + 'Svg').select('#cf' + clickedId).moveToFront().style('opacity', 1).attr('stroke', '#455A64').attr('stroke-width', '2px');
            d3.select('#' + variab + 'Svg').select('#tf' + clickedId).style('display', 'inherit');
            d3.select('#' + variab + 'Svg').select('#bg' + clickedId).style('display', 'inherit');
            d3.select('#' + variab + 'Svg').select('#tsf' + clickedId).style('display', 'inherit');
        })
        .on('click', function(d){
            theMap.tooltipDiv.style('display', 'none');
            var el = d3.select('path#fips_' + d.fips)[0][0];
            var dat = el.__data__;
            updateTable(dat);
            theMap.clicked(dat, el);
            selectedVar = variab;
            document.getElementById("drpdn").value = selectedVar;
            theMap.reDraw();
        });

    var ratioNum = svg.selectAll('nums')
        .data(ratioData)
        .enter()
        .append('g')
        .attr('class', 'cirG');

    //APPEND BACKGROUND RECT TO THE G ELEMENT NOT TO BE CUTTED BY THE NATIONAL AVERAGE LINE
    ratioNum.append('rect')
        .attr('id', function(d){ return 'bg' + d.fips; })
        .attr('width', 50)
        .attr('height', 42)
        .style('fill', '#fff')
        .attr('x', function(d) { 
            if(d.ratio != 0){
                return d.fips.toString().length > 3 ? cxMsa(d.ratio)-25 : cxState(d.ratio)-25;
            }
            else return -1000;
        })
        .attr('y', 0)
        .style('display', 'none');

    ratioNum.append('text').text(function(d){ return formatDecimal(d.ratio); })
        .attr('id', function(d){ return 'tf' + d.fips; })
        .attr('class', 'ratioNumber')
        .attr('x', function(d) { 
            if(d.ratio != 0){
                return d.fips.toString().length > 3 ? cxMsa(d.ratio) : cxState(d.ratio);
            }
            else return -1000;
        })
        .attr('y', 40)
        .attr('text-anchor', function(d) {
          var bbox = d3.select(this).node().getBBox();
          if( bbox.x + (bbox.width/2) >= width - 5) {
            return 'end';
          }
          else if(bbox.x - (bbox.width/2) <= 10){
            return 'start'
          }
          else return 'middle';
        })
        .style('display', 'none');

    ratioNum.append('text').text(function(d){ return d.fips.toString().length < 3 ? d.state : d.msa;})
        .attr('id', function(d) { return 'tsf' + d.fips; })
        .attr('class', 'ratioState')
        .attr('x', function(d) { 
            if(d.ratio != 0){
                return d.fips.toString().length > 3 ? cxMsa(d.ratio) : cxState(d.ratio);
            }
            else return -1000;
        })
        .attr('y', 15)
        .attr('text-anchor', function(d) {
          var bbox = d3.select(this).node().getBBox();
          if( bbox.x + (bbox.width/2) >= width - 5) {
            return 'end';
          }
          else if(bbox.x - (bbox.width/2) <= 10){
            return 'start'
          }
          else return 'middle';
        })
        .style('display', 'none');

    d3.select('#cf0').moveToFront().style('opacity', 1).attr('stroke', '#455A64').attr('stroke-width', '2px');
    d3.select('#tf0').style('display', 'inherit');
    d3.select('#tsf0').style('display', 'inherit');

}
var qualifierData = ['Very Low', 'Low', 'Average', 'High', 'Very High'];

function drawQualifier(colors, variab){
    //var colors = colorbrewer.BuPu["5"];
    var margin = {top: 10, right: 0, bottom: 0, left: 0},
        width = d3.select('.' + variab).node().getBoundingClientRect().width-(margin.left+margin.right),
        height = 35;
    var svg = d3.select('.' + variab).append('div').attr('id', variab + 'QualifierSvg').style('width', width + 'px').style('height', height + 'px');

    /*var rects = svg.selectAll('rects')
        .data(qualifierData)
        .enter().append('rect')
        .attr('class', 'qualifiers')
        .attr('width', width/5 - 3)
        .attr('height', 15)
        .attr('x', function(d, i) { return i * width/5 + 3;})
        .attr('rx', '5px')
        .attr('fill', function(d, i) { return colors[i];})
        .style('opacity', 0.4);*/

    svg.append('div')
        .attr('class', 'qualText')
        .html(dataset[0][0][variab]);
}

function fillQuotient(fips, variab){
    //d3.select('.quotientNumber').html(function() { return dataset[fips][0].location_quotient == '--' ? '--' : formatDecimal(dataset[fips][0].location_quotient)});
    //d3.select('.qualifier').html(dataset[fips][0].location_quotient_qualifier);
    d3.select('.' + variab ).selectAll('.qualifiers').style('opacity', 0.1)
    var elem =  d3.select('.' + variab ).selectAll('.qualifiers')[0][qualifierData.indexOf(dataset[fips][0][variab])];
    d3.select(elem).style('opacity', 1);
    d3.select('.' + variab ).select('.qualText')
        //.attr('x', function(d) { return dataset[fips][0][variab] == 'Very High' ? d3.select(elem).attr('x') - 20 : d3.select(elem).attr('x') ;})
        //.attr('y', +d3.select(elem).attr('height') *2)
        .html(dataset[fips][0][variab]);
}

function fillTopJobs(fips){
    var topJobs = [];
    for(var i=1; i < 10; i++){
        if(dataset[fips][0]['top_job_'+i].length > 2){
            topJobs.push(dataset[fips][0]['top_job_'+i]);
        }  
    }
    d3.select("#topJobsList").selectAll('li').remove();

    d3.select('#topJobsList').selectAll('li')
        .data(topJobs)
        .enter()
        .append('li')
        .html(function(d){ return d;});
}


var treemapData;

var treeMap = function(opts) {
    this.element = opts.element;
    this.createTreemap(opts.fips);
    this.initialize(opts.treeMapData);
    //this.accumulate(opts.treeMapData);
    this.layout(opts.treeMapData);
    this.display(opts.treeMapData);
}

treeMap.prototype.createTreemap = function(fips) {
    this.tooltipDiv = d3.select(this.element)
        .append("div")
        .attr("class", "treeTooltip tooltip");

    this.margin = {top: 0, right: 5, bottom: 10, left: 5};
    this.width = d3.select('.no5').select('.boxContent').node().getBoundingClientRect().width-(this.margin.left+this.margin.right);
    this.height = (this.width * 0.68) - this.margin.top - this.margin.bottom;
    this.formatNumber = d3.format(",.1f");

    this.x = d3.scale.linear()
        .domain([0, this.width])
        .range([0, this.width]);

    this.y = d3.scale.linear()
        .domain([0, this.height])
        .range([0, this.height]);


    this.treemap = d3.layout.treemap()
        .children(function(d, depth) { return depth ? null : d._children; })
        .sort(function(a, b) { return a.size - b.size; }) 
        .ratio(this.height / this.width * (1 + Math.sqrt(5))) 
        .round(false)
        .value(function(d) { return d.size; });

    this.svg = d3.select(".treemap").append("svg")
        .attr("width", this.width + this.margin.left + this.margin.right)
        .attr("height", this.height + this.margin.bottom + this.margin.top)
        .style("margin-left", -this.margin.left + "px")
        .style("margin.right", -this.margin.right + "px")
      .append("g")
        .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")")
        .style("shape-rendering", "crispEdges"); 

    this.g1 = this.svg.append('g')
            .attr("class", "depth"); 
    }


  treeMap.prototype.initialize = function(root) {
        root.x = 0;
        root.y = 5; 
        root.dx = this.width;
        root.dy = this.height;
        root.depth = 0;

        accumulate(root);

        function accumulate(d){
            return (d._children = d.children) ? d.size = 0 : d.size;
        }
      }


treeMap.prototype.layout = function(d) {
        if (d._children) {
          this.treemap.nodes({_children: d._children});
          d._children.forEach(function(c) {
            c.x = d.x + c.x * d.dx;
            c.y = d.y + c.y * d.dy;
            c.dx *= d.dx;
            c.dy *= d.dy;
            c.parent = d;
            //layout(c);
          });
        }
      }


treeMap.prototype.display = function(d) {
    var _this = this;
    var blues = ["#0472b4", "#d0d1e6","#3690c0","#0570b0","#a6bddb","#f1eef6","#74a9cf"];
    var g = this.g1.selectAll("g")
        .data(d.children);

    g.enter().append("g").attr('rel', function(d, i) { return i; }); 
    var child = g.selectAll(".child")
        .data(function(d) { return [d]; });

      child.enter().append("rect")
        .attr("class", "child")
        .attr('fill', function(d, i) { var ind = d3.select(this.parentNode).attr('rel'); return blues[ind];})
        .call(this.rect, this)
        .on("mouseover", function(d) {
            _this.tooltip(d);
            _this.tooltipDiv.style('display', 'inherit');
        })
        .on("mousemove", function() {
            d3.selectAll("rect.child").style("stroke", "#fff");
            d3.select(this.parentNode).moveToFront();
            d3.select(this).moveToFront().style("stroke", "#034e7b").attr("stroke-width", "2px");
            d3.select(this.parentNode).selectAll("text").moveToFront();

            var bodyRect = document.body.getBoundingClientRect(),
                elemRect = _this.element.getBoundingClientRect(),
                offsetTop = elemRect.top - bodyRect.top,
                offsetLeft = elemRect.left - bodyRect.left;

            var xPos = d3.event.pageX - offsetLeft;
            var yPos = d3.event.pageY - offsetTop;

            var ttWidth = parseInt(_this.tooltipDiv.style("width").replace("px", ""), 10);
            var ttHeight = parseInt(_this.tooltipDiv.style("height").replace("px", ""), 10);

            var ttLeft = xPos - (ttWidth / 2);
            var ttTop = yPos - ttHeight - 30;

            var maxRight = _this.width - (ttWidth / 2);

            if (ttLeft + (ttWidth / 2) >= maxRight) {
                ttLeft = maxRight - (ttWidth / 2);
            }

            if (ttTop < 0) {
                ttTop = yPos + 30;
            }

            if (ttLeft < 0) {
                ttLeft = 0;
            }

            _this.tooltipDiv.style({
                "top": ttTop + "px",
                "left": ttLeft + "px"
            });
        } )
        .on("mouseout", function() {
            d3.select(this.parentNode).select(".parent").moveToFront();
            d3.select(this.parentNode).selectAll("text").moveToFront();
            d3.select(this).style("stroke", "#fff").attr("stroke-width", "4px");
            _this.tooltipDiv.style('display', 'none');
        } );


    var catNames = g.selectAll('.catName')
        .data(function(d) { return [d]; })
    catNames.enter().append("text")
        .attr("dy", ".75em")
        .attr('class', 'catName')
        .text(function(d) { return d.name;});
        
    var overlaidText = g.selectAll('.overlaidText')
        .data(function(d) { return [d]; });

    overlaidText.enter().append("text")
        .classed("overlaidText",true)
        .text(function(d) { return formatThousand(d.value);});

    var tr1 = this.g1.transition().duration(500);
    tr1.selectAll("rect").call(this.rect, this);
    tr1.selectAll("text").text(function(d) { return d.name;}).call(this.text, this);
    tr1.selectAll(".overlaidText").text(function(d) { return formatThousand(d.value);}).call(this.middletext, this);
    tr1.each("end", function() { extinguishBigTxt(); });


    function extinguishBigTxt(){
      d3.select(".depth").selectAll("text")
      .style("opacity", function(d){
        var bbox = this.getBBox();
        var textWidth = bbox.width;
        var textHeight = bbox.height;
        var rectElemWidth = d3.select(this.parentNode).select(".child").attr("width") - 10;
        var rectElemHeight = parseFloat(d3.select(this.parentNode).select(".child").attr("height"));

        if(textWidth < rectElemWidth && rectElemHeight > 35){
          return 1;
        }
        else if(textWidth > rectElemWidth || textHeight > rectElemHeight || rectElemHeight < 35){ return 0; }
      });
    }

    function name(d) {
    return d.parent ? name(d.parent) + " / " + d.name : d.name;
    }

}

treeMap.prototype.text = function(text, _this) {
    text.attr("x", function(d) { return  _this.x(d.x) + 8; })
        .attr("y", function(d) { return  _this.y(d.y) + 8; });
}

treeMap.prototype.middletext = function(text, _this) {
    text.attr("x", function(d) { return  _this.x(d.x) + 8; })   
        .attr("y", function(d) { return  _this.y(d.y + d.dy) - 10; });
}

treeMap.prototype.rect = function(rect, _this) {
    rect.attr("x", function(d) { return _this.x(d.x); })
        .attr("y", function(d) { return  _this.y(d.y); })
        .attr("width", function(d) { return  _this.x(d.x + d.dx) -  _this.x(d.x); })
        .attr("height", function(d) { return  _this.y(d.y + d.dy) -  _this.y(d.y); })
        .attr("rx","3px");
}

treeMap.prototype.updateTreemap = function(fips){
    
    this.treeMapData = {
        'name': 'Postings by NICE Framework Area',
        'children': [
        {   'defs': "Specialty Areas responsible for providing the support, administration, and maintenance necessary to ensure effective and efficient information technology (IT) system performance and security.",
            'name': 'Operate & Maintain',
            'size': +dataset[fips][0].operate_maintain
        },
        {   'defs': "Specialty Areas responsible for conceptualizing, designing, and building secure information technology (IT) systems, with responsibility for some aspect of the systems' development.",
            'name': 'Securely Provision',
            'size': +dataset[fips][0].securely_provision
        },
        {   'defs': "Specialty Areas responsible for providing leadership, management, direction, or development and advocacy so the organization may effectively conduct cybersecurity work.",
            'name': 'Oversee & Govern',
            'size': +dataset[fips][0].oversight_development
        },
        {   'defs': "Specialty Areas responsible for specialized denial and deception operations and collection of cybersecurity information that may be used to develop intelligence.",
            'name': 'Collect & Operate',
            'size': +dataset[fips][0].collect_operate
        },
        {   'defs': "Specialty Areas responsible for highly specialized review and evaluation of incoming cybersecurity information to determine its usefulness for intelligence.",
            'name': 'Analyze',
            'size': +dataset[fips][0].analyze
        },
        {   'defs': "Specialty Areas responsible for identifying, analyzing, and mitigating threats to internal information technology (IT) systems or networks.",
            'name': 'Protect & Defend',
            'size': +dataset[fips][0].protect_defend
        },
        {   'defs': "Specialty Areas responsible for investigating cyber events or crimes related to information technology (IT) systems, networks, and digital evidence.",
            'name': 'Investigate',
            'size': +dataset[fips][0].investigate
        }

    ]};

    this.initialize(this.treeMapData);

    this.treemap.sort(function(a, b) { return a.size - b.size; });

    this.layout(this.treeMapData);

    this.display(this.treeMapData);
  
}

treeMap.prototype.tooltip = function(d) {

    var txt;
    txt = "<div class=\"tipAreaName\"> " + d.name + "</div>";
    txt += "<div class=\"subCat\"> " + d.defs + " </div>";
        
    d3.select(".treeTooltip").html(txt);

}

var barSvg, barHeight, gapBetweenGroups, margin, width, height, color, x, y, yAxis;
function createBars(){
    barHeight        = 9;
    gapBetweenGroups = 70;

    margin = {top: 20, right: 70, bottom: 0, left: 140},
        width = d3.select('.no6').select('.boxContent').node().getBoundingClientRect().width-(margin.left+margin.right),
        height = 410 - margin.top - margin.bottom;

    //color = d3.scale.category20();
    color = d3.scale.linear().domain([0,1])
        .range(['#f46d43', '#74add1']);
    //var chartHeight = barHeight * zippedData.length + gapBetweenGroups * data.labels.length;

    x = d3.scale.linear()
        .range([0, width]);

    y = d3.scale.ordinal()
        .rangeRoundBands([0, height - 80 + gapBetweenGroups], .1);

    yAxis = d3.svg.axis()
        .scale(y)
        .tickFormat('')
        .tickSize(0)
        .orient("left");

    barSvg = d3.select('.no6').select('.barChart').append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    barSvg.append('text')
        .attr('class', 'ratioLab')
        .attr('y', 20)
        .attr('x', width + (margin.right/2) + margin.left)
        .attr('text-anchor', 'middle')
        .text('RATIO');

    barSvg.append("g")
          .attr("class", "y axis")
          .attr("transform", "translate(" + margin.left + ", " + -gapBetweenGroups/2 + ")")
          .call(yAxis);

    d3.select('.no6').select('.barChart').append("div")
        .attr('class', 'tooltip')
        .attr('id', 'barsTtip');

}


function updateBars(fips){

    var holdersValues = [+dataset[fips][0]['security+_holders'], +dataset[fips][0]['cissp_holders'], +dataset[fips][0]['cipp_holders'], +dataset[fips][0]['cisa_holders'], +dataset[fips][0]['cism_holders']];
    var openingsValues = [+dataset[fips][0]['security+_openings'], +dataset[fips][0]['cissp_openings'], +dataset[fips][0]['cipp_openings'], +dataset[fips][0]['cisa_openings'], +dataset[fips][0]['cism_openings']];
    var data = {
        labels: ['Security+', 'Certified Information Systems Security Professional (CISSP)', 'Certified Information Privacy Professional (CIPP)', 'Certified Information Systems Auditor (CISA)', 'Certified Information Security Manager (CISM)'],
        series: [{
            label: 'Security+',
            holOp: [+dataset[fips][0]['security+_holders'], +dataset[fips][0]['security+_openings']]
        },
        {
            label: 'Certified Information Systems Security Professional (CISSP)',
            holOp: [+dataset[fips][0]['cissp_holders'], +dataset[fips][0]['cissp_openings']]
        },
        {
            label: 'Certified Information Privacy Professional (CIPP)',
            holOp: [+dataset[fips][0]['cipp_holders'], +dataset[fips][0]['cipp_openings']]
        },
        {
            label: 'Certified Information Systems Auditor (CISA)',
            holOp: [+dataset[fips][0]['cisa_holders'], +dataset[fips][0]['cisa_openings']]
        },
        {
            label: 'Certified Information Security Manager (CISM)',
            holOp: [+dataset[fips][0]['cism_holders'], +dataset[fips][0]['cism_openings']]
        }
        ]
    };


    var zippedData = [];
    for (var i=0; i<data.labels.length; i++) {
      for (var j=0; j<data.series[0].holOp.length; j++) {
        zippedData.push(data.series[i].holOp[j]);
      }
    }

    var descr = ['Security+ covers essential principles for network security and risk management, and is a foundational credential for workers in IT security.',
            'CISSP is an advanced security credential that demonstrates the technical and managerial competence, skills, experience, and credibility to design, engineer, implement, and manage information security programs.',
            'CIPP demonstrates foundational understanding of global concepts of privacy and data protection laws and practice.',
            'CISA demonstrates audit experience, skills, and knowledge, as well as the ability to assess vulnerabilities, report on compliance, and institute controls within an enterprise.',
            'CISM is a management-focused certification that demonstrates the ability to manage the design, oversight, and assessment of an IT security program.'
    ];

    var level = ['Career Starter', 'Career Advancer', 'Career Advancer', 'Career Advancer', 'Career Advancer'];
    var pos = ['50px', '165px', '255px', '335px', '230px'];
    x.domain([0, d3.max(zippedData)]);
    y.domain(data.labels);

    var gi = barSvg.selectAll('g.gi')
        .data(data.series);
        
    var giEnter = gi.enter().append('g')
        .attr('class', 'gi')
        .attr("transform", function(d, i) {
          return "translate(" + 0 + "," + y(d.label) + ")" ;
        });

    var bar = gi.selectAll("g.bar")
        .data(function(d){ return d.holOp;});

    var barEnter = bar.enter().append("g")
        .attr('class', function(d, i) { return i % 2 == 0 ? ' bar first' : 'bar second'; })
        .attr("transform", function(d, i) {
          return i % 2 == true ? "translate(" + margin.left + "," + (i * barHeight + gapBetweenGroups * (0.6 + Math.floor(i/data.series.length))) + ")" : "translate(" + margin.left + "," + (i * barHeight + gapBetweenGroups * (0.5 + Math.floor(i/data.series.length))) + ")" ;
        });

    barEnter.append("rect")
        .attr("fill", function(d,i) { return color(i % data.series.length); })
        .attr("class", "bar")
        //.attr("width", function(d) { return x(d); })
        .attr("height", barHeight - 1);

    // Add text label in bar
    barEnter.append("text")
        //.attr("x", function(d) { return x(d) - 3; })
        .attr("y", function(d, i) { return i % 2 == true ? 20 : -10; })
        .attr("class", "barNum")
        .attr("dy", ".35em")
        .attr("fill", function(d,i) { return color(i % data.series.length); });
        //.text(function(d) { return d; });

    // Draw labels
    giEnter.append("text")
        .attr("class", "label")
        .attr("x", function(d) { return 130; })
        .attr("y", 35)
        .attr("dy", ".45em")
        .attr('text-anchor', 'end')
        .style('cursor', 'default')
        .text(function(d,i) {
            return data.labels[i];})
        .call(wrap, 130)
        .on('mouseover', function(d,i){
            var ind = i;
            var _this = this;
            d3.select('#barsTtip').html(
                '<div class="level">Level: ' + '<strong>' + level[i] + '</strong>' + '</div>' +
                '<div class="descr">' + descr[i] + '</div>'
                )
            .style('top', function(d, i) { 
                var t = d3.transform(d3.select(_this.parentNode).attr('transform')),
                    y = t.translate[1];
                    return ind !== 4 ? (y + 70) + 'px' : (y -135) + 'px'; 
            })
            .style('display', 'inherit');
        })
        .on('mouseout', function() { d3.select('#barsTtip').style('display', 'none')});

    barEnter.append('line')
        .attr('class', 'barsLine')
        .attr("x1", 0)
        .attr("y1", -4)
        .attr("x2", width + (margin.right/2)) 
        .attr("y2", -4)
        .attr('stroke', '#CFD8DC')
        //.attr('stroke-dasharray', '2,2')
        .style('display', function(d, i) { return i % 2 == 0 ? 'none' : 'inherit'; });

    barEnter.append('circle')
        .attr('class', 'barsCirc')
        //.attr('stroke-dasharray', '2,2')
        .attr('stroke', '#CFD8DC')
        .attr('cx', width + (margin.right/2))
        .attr('cy', -5)
        .attr('r', 23)
        .attr('fill', '#fff')
        .style('display', function(d, i) { return i % 2 == 0 ? 'none' : 'inherit'; });

    d3.selectAll('.barRatio').remove();
    var ratioN = barSvg.selectAll('g.second');
    ratioN.append('text')
        .attr('class', 'barRatio')
        .attr('x', width + (margin.right/2))
        .attr('text-anchor', 'middle')
        .text(function(d, i) { return isFinite(holdersValues[i]/openingsValues[i]) == true ? formatDecimal(holdersValues[i]/openingsValues[i]) : 'N/A'; });
    

    var rectSel = bar.selectAll("rect.bar");
    var gSel = d3.selectAll('g.bar');
    //.sort(function(a, b) { return x0(a.letter) - x0(b.letter); });
    rectSel.transition().duration(500)
        .attr("width", function(d, i, j) { return isNaN(rectSel[j].parentNode.__data__ ) == false ? x(rectSel[j].parentNode.__data__) : x(5); });

    bar.selectAll("text.barNum").transition().duration(500)
        .attr("x", 0/*function(d, i, j) { return isNaN(rectSel[j].parentNode.__data__ ) == false ? x(rectSel[j].parentNode.__data__) - 3 : x(5) - 3; }*/)
        .text(function(d, i, j) { return isNaN(rectSel[j].parentNode.__data__ ) == false ? formatThousand(rectSel[j].parentNode.__data__) : '<10'; })
        .attr('text-anchor', 'start');
        //.each('end', setAnchor);

    /*bar.selectAll(".barsLine").transition().duration(500)
        .style("stroke", function(d, i){
            var rat = d3.select(this.parentNode.parentNode)[0][0].__data__.holOp[0]/d3.select(this.parentNode.parentNode)[0][0].__data__.holOp[1];
            if(isFinite(rat) == true){
                if(rat > 1){
                    return '#f46d43';
                }
                else return '#74add1';
            }
            else return '#455A64';
        });*/
/*    bar.selectAll(".barsCirc").transition().duration(500)
        .style("stroke", function(d, i){
            var rat = d3.select(this.parentNode.parentNode)[0][0].__data__.holOp[0]/d3.select(this.parentNode.parentNode)[0][0].__data__.holOp[1];
            if(isFinite(rat) == true){
                if(rat > 1){
                    return '#f46d43';
                }
                else return '#74add1';
            }
            else return '#455A64';
        })*/

    var y0 = y.domain(data.series.sort(function(a, b){
        if (isNaN(a.holOp[0]) == true) {
            return (b.holOp[0]/b.holOp[1]) - 0;
        };
        if (isNaN(b.holOp[0]) == true){
            return 0 - (a.holOp[0]/a.holOp[1]);
        }
        else return (b.holOp[0]/b.holOp[1]) - (a.holOp[0]/a.holOp[1]);
        
    }).map(function(d){return d.label}))
        .copy();

    d3.selectAll('.gi')
        .transition().duration(500)
        .attr("transform", function(d, i) {
          return "translate(" + 0 + "," + y0(d.label) + ")" ;
        });

    function setAnchor(){
        d3.select(this)
        .attr('text-anchor', function(d) { 
            var bbox = d3.select(this).node().getBBox();
            if(bbox.x - bbox.width <= 0){
                return 'start';
            }
            else return 'end';
        });
    }
}

function drawLegend(){
    var legend = theMap.svg.append("g")
      .attr("class", "leg");

    if(mapW > 600){
        legend.attr("transform", "translate(" + theMap.width/1.20 + "," + theMap.height/2.35 + ")");
    }
    else if (mapW < 330) {
        legend.attr("transform", "translate(" + theMap.width/2.15 + "," + theMap.height * 0.09 + ")");
    }
    else legend.attr("transform", "translate(" + theMap.width/1.95 + "," + theMap.height * 0.09 + ")");
      


    legend.append("text")
        .attr('class', 'legendVar')
        .style("font-size", function() { return mapW > 600 ? '12px' : '11px'; } )
        .text("Total job postings")
        .attr("transform", "translate(" + 0 + "," + (-6) + ")");

    var entry = legend.selectAll('g.legendEntry')
      .data(quantile.range())
      .enter()
      .append('g').attr('class', 'legendEntry');

    
    legend
        .append('rect')
        .attr("x", function() { return mapW > 600 ? 0 : 150;})
        .attr("y", function() { return mapW > 600 ? 115 : 0; } )
       .attr("width", 20)
       .attr("height", 10)
       .attr("fill", '#ddd')
       .attr('class', 'noMsaR');
    legend
        .append('text')
        .attr("y", function() { return mapW > 600 ? 115 : 15; } ) //leave 10 pixel space after the <rect>
        .attr("x", function() { return mapW > 600 ? 33 : 159;})
        .attr("dy", "0.8em") //place text one line *below* the x,y point
        .attr("dx", "-0.8em")
        .attr("font-size", "10px")
        .attr('class', 'naTxt')
        .text(function() { return mapW > 600 ? 'No MSA' : 'N/A'; })
        .attr('class', 'noMsaT');

    entry
        .append('rect')
        .attr("y", function(d, i) {
           return mapW > 600 ? i * 16 : 0;
        })
        .attr("x", function(d, i) {
           return mapW > 600 ? 0 : i * 21;
        })
       .attr("width", 20)
       .attr("height", 10)
       .attr("fill", function(d){ return d;});

    entry
        .append('text')
        .attr("y", function(d, i) {
           return mapW > 600 ? i * 16 : 15;
        }) //leave 5 pixel space after the <rect>
        .attr("x", function(d, i) {
           return mapW > 600 ? 33 : i * 21;
        })
        .attr("dy", "0.8em") //place text one line *below* the x,y point
        .attr("dx", "-0.8em")
        .attr("font-size", "10px")
        .attr('class', 'legendTxt')
        .text(function(d,i) {
            selectedVar == undefined ? selectedVar = 'total_postings' : selectedVar = selectedVar;
            return setLegendLabel(d, i);
        });

    var bbox = d3.select('.leg').node().getBBox();
    legend.insert('rect', ':first-child')
        .attr('width', function() { return mapW > 600 ? 125 : 175; })
        .attr('height', bbox.height + 6)
        .attr('y', bbox.y - 3)
        .attr('x', bbox.x - 4)
        .attr('rx', 5)
        .attr('ry', 5)
        .attr('fill', '#fff');
}

//LINES BREAK FUNCTION
function wrap(text, width) {
    text.each(function() {
      var text = d3.select(this),
          words = text.text().split(/\s+/).reverse(),
          word,
          line = [],
          lineNumber = 0,
          lineHeight = 1.3, // ems
          y = text.attr("y"),
          x = text.attr("x"),
          dy = parseFloat(text.attr("dy")),
          tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
      while (word = words.pop()) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
        }
      }
    });
}

function isBigEnough(value) {
  return function(element, index, array) {
    return (element >= value);
  }
}


//Move to front and back
d3.selection.prototype.moveToFront = function() {
    return this.each(function() {
        this.parentNode.appendChild(this);
    });
};

d3.selection.prototype.moveToBack = function() {
    return this.each(function() {
        var firstChild = this.parentNode.firstChild;
        if (firstChild) {
            this.parentNode.insertBefore(this, firstChild);
        }
    });
};