var graph;
var levels = ["Entry-Level", "Mid-Level", "Advanced-Level"];
var jobsDataset, catsData;
var nodes, links;
var clicked = false;
var clickedId;
var formatThousand = d3.format(",d");
var pathwayW;
queue()
    .defer(d3.csv, "data/career_pathway_links_data.csv")
    .defer(d3.csv, "data/career_pathway_jobs_data.csv")
    .defer(d3.csv, "data/areas_subcategories_ksa.csv")
    .await(ready);

function ready(error, data, jobsData, categoriesData) {
    pathwayW = parseInt(d3.select('.container').style('width'));
    graph = {"nodes" : [], "links" : []};
  
    data.forEach(function (d, i) {
      graph.nodes.push({ "id": d.source_id, "name": d.source, "level": d.level });
      //graph.nodes.push({ "name": d.target });

      graph.links.push({ "source": d.source,
                         "source_id": d.source_id,
                         "target": d.target,
                         "target_id": d.target_id,
                         "value": d.value });
    })  

    var nestByName = d3.nest()
      .key(function(d) { return d.name; });

    var nameEntries = nestByName.entries(graph.nodes);

    graph.nodes = nameEntries.map(function(entry) { return entry.values[0]; });

    // Compute the distinct nodes from the links.
    graph.links.forEach(function (d, i) {
      graph.links[i].source = graph.nodes.map(function(obj, index) { if(obj.name == graph.links[i].source) { return index; }}).filter(isFinite)[0];
      graph.links[i].target = graph.nodes.map(function(obj, index) { if(obj.name == graph.links[i].target) { return index; }}).filter(isFinite)[0];
    });

    //now loop through each nodes to make nodes an array of objects rather than an array of strings
    graph.nodes.forEach(function (d, i) {
      graph.nodes[i] = { "id": d.id, "name": d.name, "level": d.level };
    });
    //add internal index for each level to use in cx
    var result;
    for(var i = 0; i < levels.length; i++){
        result = graph.nodes.filter(function( obj ) {
          return obj.level == levels[i];
    }); 

    for(var z = 0; z < result.length; z++){
          result[z]['levelIndex'] = z;
          result[z]['levelLength'] = result.length;
        }
    }

    jobsDataset = d3.nest()
          .key(function(d) { return d.id; })
          .entries(jobsData);

    //Parse nice framework data
    catsData = d3.nest()
      .key(function(d) { return d.id; })
      .key(function(d) { return d.nice_areas; })
      .key(function(d) { return d.nice_subcategories; })
      .entries(categoriesData);

    draw();
    drawCircleChart("average_salary", ".no1");
    drawCircleChart("job_openings", "#no2");
    drawStackedBar();

    //FILL THE LISTS
    fillList('commonJobsList', 'e1', 'common_job_titles');
    fillList('topCertificationsList', 'e1', 'top_certifications');
    fillList('topSkillsList', 'e1', 'top_skills');

    //UPDATE STACKED BAR
    d3.selectAll('.educationChart').style('display', 'inherit');
    updateStackedBar('e1')

    //FILL NICE AREAS
    fillAreas('e1');

    new ShareButton({networks: {
            email: {
                enabled: false
            }
        }});

    setBoxHeight();
    var parentNode = document.getElementById('r1');
    var nodeToMove = document.getElementById('c2');
    var referenceNode = document.getElementById('c4');
    var col3 = document.getElementById('c3');
    if(pathwayW < 1000 && pathwayW > 575){
        parentNode.insertBefore(referenceNode, nodeToMove);
    }
    else if(pathwayW <= 575){
      parentNode.insertBefore(referenceNode, nodeToMove);
      parentNode.insertBefore(col3, nodeToMove);
    }
    d3.select(window).on('resize', function() {
        pathwayW = parseInt(d3.select('.container').style('width'));
        
        if(pathwayW < 1000){
            parentNode.insertBefore(referenceNode, nodeToMove);
        }
    });

    $('.table').css('display', 'none');

    d3.selectAll('.infIcon')
        .on('click', function(d){
            d3.select('#b' + d3.select(this).attr('rel')).style('display', 'inherit');
        })

    d3.selectAll('.closeBtn')
        .on('click', function(d){
            d3.select('#b' + d3.select(this).attr('rel')).style('display', 'none');
        })
}


function draw(){
  // Extract the nodes and links from the data.
  nodes = graph.nodes;
  links = graph.links;
  var tooltip = d3.select('.pathway').append('div').attr('class', 'tooltip');
  var clientRect = d3.select('.pathway').node().getBoundingClientRect();
  var margin = {top: 30, right: clientRect.width*0.1, bottom: 15, left: clientRect.width*0.1},
    width = clientRect.width - margin.left - margin.right,
    height;
  var r;

  pathwayW > 550 ? margin.left = margin.left : margin.left = 20;
  pathwayW > 550 ? margin.right = margin.right : margin.right = 50;
  pathwayW > 550 ? height = (clientRect.width * 0.6) - margin.top - margin.bottom : height = (clientRect.width * 1.1) - margin.top - margin.bottom;
  pathwayW > 685 ? r = height * 0.11 : r = 15;
  console.log(r);
  var cxScale = d3.scale.ordinal()
      .domain(levels)
      .rangeRoundPoints([40, width]);

  var rScale = d3.scale.sqrt()
    .domain(d3.extent(jobsDataset.map(function(key) { return +key.values[0].job_openings; })))
    .range([height/10, height/7]);

  for(var i = 0; i < nodes.length; i++){
    nodes[i].fixed = true;
    nodes[i].x = cxScale(nodes[i].level);
    nodes[i].y = nodes[i].levelIndex * (height / nodes[i].levelLength) + ((height/2) / nodes[i].levelLength);
  }
  
  var diagonal = d3.svg.diagonal()
    .projection(function(d) { return [d.y, d.x]; });

  var svg = d3.select(".pathway").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

  svg.append('rect')
      .attr('width', width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr('class', 'backGrndClick')
      .style('z-index', -100)
      .style('fill', '#fff')
      .on('click', unclick);

  var levelines = svg.append("g").attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")")
    .selectAll('.levLines')
    .data(levels);

  var gi = levelines.enter().append('g');

  gi.append('line')
    .attr("x1", function(d, i){ return cxScale(d);})
    .attr("y1", 0)
    .attr("x2", function(d, i){ return cxScale(d);}) 
    .attr("y2", height)
    .style('stroke', '#eaeaea');

  gi.append('text')
    .attr('class', 'levLab')
    .attr('x', function(d, i){ return cxScale(d);})
    .attr('y', -5)
    .attr('text-anchor', 'middle')
    .text(function(d) { return d;});


  // Per-type markers, as they don't inherit styles.
  svg.append("defs").append("marker")
      .attr("id", "marker")
      .attr('class', 'mark')
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("orient", "auto")
    .append("path")
      .attr('fill', '#546e7a')
      .attr("d", "M0,-5L10,0L0,5");

  var labelSel = d3.selectAll('.levLab');
  var bbox1 = labelSel[0][0].getBBox();
  var bbox2 = labelSel[0][1].getBBox();
  var bbox3 = labelSel[0][2].getBBox();
  var mar = width * 0.03;
  var p1 = bbox1.x + bbox1.width;
  var p2 = bbox2.x;
  var p3 = bbox2.x + bbox2.width;
  var p4 = bbox3.x ;

  var arrows = svg.append("g").attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");

  arrows.append('line')
    .attr('x1', p1 + mar)
    .attr("y1", bbox1.y + 9)
    .attr("x2", p2 - mar) 
    .attr("y2", bbox1.y + 9)
    .style('stroke', '#eaeaea')
    .attr("marker-end", "url(#marker)");

  arrows.append('line')
    .attr('x1', p3 + mar)
    .attr("y1", bbox1.y + 9)
    .attr("x2", p4 -mar) 
    .attr("y2", bbox1.y + 9)
    .style('stroke', '#eaeaea')
    .attr("marker-end", "url(#marker)");

  var path = svg.append("g").attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")").selectAll("path")
      .data(links);

    path.enter().append("path")
      .attr("class", "link backLink")
      .attr("d", function(d, i) {
        if(d.source_id.charAt(0) == d.target_id.charAt(0)){
            var sourceObj = jobsDataset.filter(function( obj ) {
              return obj.key == d.source_id;
            });
            var targetObj = jobsDataset.filter(function( obj ) {
              return obj.key == d.target_id;
            });
            
            var arcMidTar = 2*Math.PI*r/*rScale(+targetObj[0].values[0].job_openings)*/*(90/360)-8;
            var arcMidSrc = 2*Math.PI*r/*rScale(+sourceObj[0].values[0].job_openings)*/*(90/360)-8;

            var dx = nodes[d.target].x - nodes[d.source].x,
                  dy = nodes[d.target].y - nodes[d.source].y,
                  dr = Math.sqrt((dx * dx + dy * dy)*0.4);
              return nodes[d.source].y > nodes[d.target].y ? "M" + (nodes[d.source].x - (arcMidSrc/2)) + "," + (nodes[d.source].y - (arcMidSrc/2)) + "A" + dr + "," + dr + " 0 0,1 " + (nodes[d.target].x - (arcMidTar/2)) + "," + (nodes[d.target].y + (arcMidTar/2))
              : "M" + (nodes[d.source].x + (arcMidSrc/2)) + "," + (nodes[d.source].y + (arcMidSrc/2)) + "A" + dr + "," + dr + " 0 0,1 " + (nodes[d.target].x + (arcMidTar/2)) + "," + (nodes[d.target].y - (arcMidTar/2));
        }
        else {
            var sourceObj = jobsDataset.filter(function( obj ) {
              return obj.key == d.source_id;
            });
            var targetObj = jobsDataset.filter(function( obj ) {
              return obj.key == d.target_id;
            });
            var so = {x: nodes[d.source].y , y: nodes[d.source].x + r/*rScale(+sourceObj[0].values[0].job_openings)*/};
            var to = {x: nodes[d.target].y, y: nodes[d.target].x - r/*rScale(+targetObj[0].values[0].job_openings)*/}
            return diagonal({source: so, target: to});
        }
      })
      .style('display', 'none');

    var pathFront = path.enter().append("path")
      .attr("class", "link frontLink")
      .attr("marker-end", "url(#marker)")
      //.attr("marker-mid", "url(#marker)")
      .attr("d", function(d, i) {
        if(d.source_id.charAt(0) == d.target_id.charAt(0)){
            var sourceObj = jobsDataset.filter(function( obj ) {
              return obj.key == d.source_id;
            });
            var targetObj = jobsDataset.filter(function( obj ) {
              return obj.key == d.target_id;
            });
            
            var arcMidTar = 2*Math.PI*r/*rScale(+targetObj[0].values[0].job_openings)*/*(90/360)-8;
            var arcMidSrc = 2*Math.PI*r/*rScale(+sourceObj[0].values[0].job_openings)*/*(90/360)-8;

            var dx = nodes[d.target].x - nodes[d.source].x,
                  dy = nodes[d.target].y - nodes[d.source].y,
                  dr = Math.sqrt((dx * dx + dy * dy)*0.4);
              return nodes[d.source].y > nodes[d.target].y ? "M" + (nodes[d.source].x - (arcMidSrc/2)) + "," + (nodes[d.source].y - (arcMidSrc/2)) + "A" + dr + "," + dr + " 0 0,1 " + (nodes[d.target].x - (arcMidTar/2)) + "," + (nodes[d.target].y + (arcMidTar/2))
              : "M" + (nodes[d.source].x + (arcMidSrc/2)) + "," + (nodes[d.source].y + (arcMidSrc/2)) + "A" + dr + "," + dr + " 0 0,1 " + (nodes[d.target].x + (arcMidTar/2)) + "," + (nodes[d.target].y - (arcMidTar/2));
        }
        else {
            var sourceObj = jobsDataset.filter(function( obj ) {
              return obj.key == d.source_id;
            });
            var targetObj = jobsDataset.filter(function( obj ) {
              return obj.key == d.target_id;
            });
            var so = {x: nodes[d.source].y , y: nodes[d.source].x + r/*rScale(+sourceObj[0].values[0].job_openings)*/};
            var to = {x: nodes[d.target].y, y: nodes[d.target].x - r/*rScale(+targetObj[0].values[0].job_openings)*/}
            return diagonal({source: so, target: to});
        }
      })
      .style('display', 'none');

  var circleContainer = svg.append("g").attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");

  var g = circleContainer.selectAll("g")
      .data(nodes)
    .enter().append("g")
    .attr('class', 'circleCont');

  g.append('circle')
    .attr('class', 'jobRoles')
    .attr('id', function(d) { return d.id;})
    .attr('cx', function(d) { return d.x;})
    .attr('cy', function(d) { return d.y;})
    .attr('r', function(d) { 
        /*var rightObj = jobsDataset.filter(function( obj ) {
          return obj.key == d.id;
        });*/
        return r;//rScale(+rightObj[0].values[0].job_openings);
    })
    .on('mouseover', function(d){
        highlightSelection(d, this);
        showToolTip(d, this);
    })
    .on('mouseout', function(d){
        d3.selectAll('.circleCont').select('text').style('opacity', 1)
        d3.selectAll('.jobRoles').style('stroke', '#29B6F6').style('stroke-width', '2px').style('fill', '#f7f8f9');
        d3.selectAll(".link").style('display', 'none');
        d3.select(".tooltip").style('display', 'none');
    })
    .on('click', function(d, i){
      
      if(clicked == true && d.id == clickedId){
        unclick();
      }
      else clickHandler(d, i, this);
      setBoxHeight();
    });


  var text = g.append("text")
    .attr("x", function(d) { return d.x;})
    .attr("y", function(d) { return d.y;})
    .attr("dy", ".35em")
    .attr('text-anchor', 'middle')
    .text(function(d) { return d.name; })
    .call(wrap, 80);

  d3.select('.pathway').selectAll('tspan').attr('y', function(d) { 
    var selSpan = d3.select(this.parentNode).selectAll('tspan');
    if(selSpan[0].length == 1){
        return pathwayW > 685 ? d.y : d.y + 25;
    }
    else if(selSpan[0].length == 2){
        return pathwayW > 685 ? d.y - 5 : d.y + 25;
    }
    else if(selSpan[0].length == 3){
        return pathwayW > 685 ? d.y - 13 : d.y + 25;
    }
    else return d.y - 18;
  })
}

function clickHandler(data, i, element){
    $('.table').css('opacity', 1);
    $('.table').slideDown('fast');
    /*d3.select('.blur').style('filter', 'none)')
      .style('-webkit-filter', 'none')
      .style('-moz-filter', 'none')
      .style('-o-filter', 'none')
      .style('-ms-filter', 'none');
    d3.select('.instr').style('display', 'none');*/
    //Fill Job Title
    d3.select('.job').html(data.name);

    //Handle Network Chart
    d3.selectAll('.link').style('display', 'none');

    //Handle Salary Chart
    var selObj = jobsDataset.filter(function( obj ) {
      return obj.key == data.id;
    });
    d3.select('.salaryNum').html("$" + formatThousand(selObj[0].values[0].average_salary));
    d3.selectAll('.circ').style('opacity', 0.5).style('stroke-width', '0px');
    d3.selectAll('.jobTitle').style('display', 'none');
    d3.selectAll('.number').style('display', 'none');
    d3.select('#average_salarySvg').selectAll('rect').style('display', 'none');
    d3.select('#job_openingsSvg').selectAll('rect').style('display', 'none');
    var selId = d3.select(element).attr('id');
    d3.select('#average_salarySvg').select('#rect' + selId).moveToFront().style('display', 'inherit'); 
    d3.select('#average_salarySvg').select('#cf' + selId).moveToFront().style('fill', '#f46d43').style('opacity', 1).style('stroke', '#455A64').style('stroke-width', '2px');
    //d3.select('#average_salarySvg').select('#tf' + selId).style('display', 'inherit');
    d3.select('#average_salarySvg').select('#tsf' + selId).moveToFront().style('display', 'inherit');

    //Handle Job Openings Chart
    d3.select('.openingsNumber').html(formatThousand(selObj[0].values[0].job_openings));
    d3.select('#job_openingsSvg').select('#rect' + selId).moveToFront().style('display', 'inherit');
    d3.select('#job_openingsSvg').select('#cf' + selId).moveToFront().style('fill', '#74add1').style('opacity', 1).style('stroke', '#455A64').style('stroke-width', '2px'); 
    //d3.select('#job_openingsSvg').select('#tf' + selId).style('display', 'inherit');
    d3.select('#job_openingsSvg').select('#tsf' + selId).moveToFront().style('display', 'inherit');

    highlightSelection(data, element);

    //FILL THE LISTS
    fillList('commonJobsList', data.id, 'common_job_titles');
    fillList('topCertificationsList', data.id, 'top_certifications');
    fillList('topSkillsList', data.id, 'top_skills');

    //UPDATE STACKED BAR
    d3.selectAll('.educationChart').style('display', 'inherit');
    updateStackedBar(data.id)

    //FILL NICE AREAS
    fillAreas(data.id);

    //Disable Event Listeners
    d3.selectAll('.jobRoles').on('mouseover', null).on('mouseout', null);
    clicked = true;
    clickedId = data.id;

    d3.select(".tooltip").style('display', 'none');
}

function highlightSelection(d, elem){
  var currSel = d.id;
  d3.selectAll('.jobRoles').style('stroke', '#d4f0fd').style('stroke-width', '2px').style('fill', '#f7f8f9');
  d3.selectAll('.circleCont').select('text').style('opacity', 0.2);
  
  var sourceLinks = d3.selectAll(".link").filter(function(b) { return nodes[b.source].id == currSel ;});
  var targetLinks = d3.selectAll(".link").filter(function(b) { return nodes[b.target].id == currSel ;});
  var sourceFrontLinks = d3.selectAll(".frontLink").filter(function(b) { return nodes[b.source].id == currSel ;});
  var targetFrontLinks = d3.selectAll(".frontLink").filter(function(b) { return nodes[b.target].id == currSel ;});
  sourceLinks.style('display', 'inherit');
  targetLinks.style('display', 'inherit');
  for(var i = 0; i < sourceFrontLinks[0].length; i++){
      //Animate path
      var str = d3.select(sourceFrontLinks[0][i]);
      var totalLength = sourceFrontLinks[0][i].getTotalLength();
      str
        .attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
          .duration(250)
          .ease("linear")
          .attr("stroke-dashoffset", 0);

      d3.selectAll('.circleCont').filter(function(b){ return b.name == nodes[sourceLinks[0][i].__data__.target].name }).select('text').style('opacity', 1);
      d3.selectAll('.circleCont').filter(function(b){ return b.name == nodes[sourceLinks[0][i].__data__.target].name }).select('circle').style('stroke', '#29B6F6');
  }
  for(var i = 0; i < targetFrontLinks[0].length; i++){
      //Animate path
      var str = d3.select(targetFrontLinks[0][i]);
      var totalLength = targetFrontLinks[0][i].getTotalLength();
      str
        .attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
          .duration(250)
          .ease("linear")
          .attr("stroke-dashoffset", 0);
      d3.selectAll('.circleCont').filter(function(b){ return b.name == nodes[targetLinks[0][i].__data__.source].name }).select('text').style('opacity', 1);
      d3.selectAll('.circleCont').filter(function(b){ return b.name == nodes[targetLinks[0][i].__data__.source].name }).select('circle').style('stroke', '#29B6F6');
  }
  d3.select(elem.parentNode).select('text').style('opacity', 1);
  d3.select(elem).style('stroke', '#455a64').style('stroke-width', '3px').style('fill', '#9addfb');
}

function unclick(){
  $('.table').slideUp('fast');
  /*d3.select('.blur').style('filter', 'blur(7px)')
      .style('-webkit-filter', 'blur(7px')
      .style('-moz-filter', 'blur(7px')
      .style('-o-filter', 'blur(7px')
      .style('-ms-filter', 'blur(7px');
  d3.select('.instr').style('display', 'block');*/
  d3.select('.job').html(' ');
  /*d3.select('.salaryNum').html("$0");
  d3.select('.openingsNumber').html("0");*/
  d3.selectAll('.circleCont').select('text').style('opacity', 1);
  d3.selectAll('.jobRoles').style('stroke', '#29B6F6').style('stroke-width', '2px').style('fill', '#f7f8f9');
  d3.selectAll('.link').style('display', 'none');
  d3.selectAll('.circ').style('opacity', 0.5).style('stroke-width', '0px');
  //d3.selectAll('.jobTitle').style('display', 'none');
  //d3.selectAll('.number').style('display', 'none');
  d3.selectAll('.jobRoles')
    .on('mouseover', function(d){ highlightSelection(d, this); showToolTip(d, this);})
    .on('mouseout', function(d){
      d3.selectAll('.circleCont').select('text').style('opacity', 1);
      d3.selectAll(".link").style('display', 'none');
      d3.selectAll('.jobRoles').style('stroke', '#29B6F6').style('stroke-width', '2px').style('fill', '#f7f8f9');
      d3.select(".tooltip").style('display', 'none');
  });
  //d3.selectAll('.educationChart').style('display', 'none');
  //d3.select('.table').selectAll('li').remove();
  //d3.selectAll('.areaBtns').remove();
  //d3.selectAll('.subCatsUl').remove();
  //d3.select('.row2').style('display', 'none');
  clicked = false;
  clickedId = '';
}

function showToolTip(d, el){
  var rightObj = jobsDataset.filter(function( obj ) {
    return obj.key == d.id;
  });
  var tipContent = "<div class='tipJob'>" + d.name + "</div>" + "<div class='var'>Job openings</div>" + "<div class='tipValue op'>" + formatThousand(rightObj[0].values[0].job_openings) + "</div>" + "<div class='var'>Average salary</div>" + "<div class='tipValue sal'>" + '$' + formatThousand(rightObj[0].values[0].average_salary) + "</div>" + "<div class='more'>Click the circle for more info</div>";
  d3.select('.tooltip').html(tipContent).style('display', 'inherit');
  var clientRect = d3.select('.tooltip').node().getBoundingClientRect();
  var pathwayRect = d3.select('.pathway').node().getBoundingClientRect();
  d3.select('.tooltip').style('top', (d.y + 35 + (+d3.select(el).attr('r'))) + 'px').style('left', (d.x + (pathwayRect.width * 0.1) - (clientRect.width/2)) + 'px');
}

//---------------------SALARY & JOB OPENINGS CHARTS ------------------------//

function drawCircleChart(variab, container1){

    var salaryData = [];
    jobsDataset.forEach(function(d){ 
        var regObj = {};
        regObj["id"] = d.key;
        regObj["title"] = d.values[0].job_title;
        regObj["value"] = +d.values[0][variab];
        salaryData.push(regObj);
    })

    var margin = {top: 0, right: 0, bottom: 0, left: 0},
        width = d3.select(container1).select('.boxContent').node().getBoundingClientRect().width-(margin.left+margin.right),
        height = 120;
    var r = 15;
    var cxScale = d3.scale.linear().domain(d3.extent(salaryData, function(d){ return d.value; })).range([20, width - 20]);

    var svg = d3.select('#' + variab + 'Chart').append('svg').attr('id', variab + 'Svg').attr('width', width).attr('height', height);

    svg.append('line')
        .style("stroke", '#455A64')
        .attr("x1", 0)
        .attr("y1", height/2)
        .attr("x2", width) 
        .attr("y2", height/2);

    var circles = svg.selectAll("circles")
        .data(salaryData)
        .enter()
        .append('circle')
        .attr('id', function(d){ return 'cf' + d.id; })
        .attr('class', variab + ' circ')
        .attr('cy', height/2)
        .attr('r', r)
        .attr('cx', function(d) { return cxScale(d.value); })
        .on('mouseover', function(d, i){
            d3.select(this).moveToFront().style('stroke', '#455A64').style('stroke-width', '2px').style('opacity', 1);
            d3.select('#' + variab + 'Svg').select('#rect' + d.id).moveToFront().style('display', 'inherit'); 
            d3.select('#' + variab + 'Svg').select('#tf' + d.id).moveToFront().style('display', 'inherit'); 
            d3.select('#' + variab + 'Svg').select('#tsf' + d.id).moveToFront().style('display', 'inherit');
            d3.select(d3.select('#' + variab + 'Svg').select('#tsf' + d.id)[0][0].parentNode).moveToFront();
            d3.select('#' + variab + 'Svg').select('#rect' + clickedId).style('display', 'none'); 
            d3.select('#' + variab + 'Svg').select('#tsf' + clickedId).style('display', 'none');
        })
        .on('mouseout', function(d){
            d3.select(this).moveToBack().style('stroke', 'none').style('opacity', 0.5);
            d3.select('#' + variab + 'Svg').select('#rect' + d.id).moveToBack().style('display', 'none');
            d3.select('#' + variab + 'Svg').select('#tf' + d.id).style('display', 'none'); 
            d3.select('#' + variab + 'Svg').select('#tsf' + d.id).style('display', 'none');
            d3.select('#' + variab + 'Svg').select('#cf' + clickedId).moveToFront().style('stroke', '#455A64').style('stroke-width', '2px').style('opacity', 1);
            d3.select('#' + variab + 'Svg').select('#rect' + clickedId).moveToFront().style('display', 'inherit'); 
            d3.select('#' + variab + 'Svg').select('#tsf' + clickedId).moveToFront().style('display', 'inherit');
        })
        .on('click', function(d, i){
          var data = d3.select('#' + d.id)[0][0].__data__;
          var el = d3.select('#' + d.id)[0][0];
          clickHandler(data, i, el);
          setBoxHeight();
        });

    var salaryNum = svg.selectAll('nums')
        .data(salaryData)
        .enter()
        .append('g');

    salaryNum.append('text').text(function(d){ return formatThousand(d.value); })
        .attr('id', function(d){ return 'tf' + d.id; })
        .attr('class', variab + ' number')
        .attr('x', function(d){ return cxScale(d.value); })
        .attr('y', (height/2 + r*2) + 3)
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


    salaryNum.append('text').text(function(d){ return d.title;})
        .attr('id', function(d) { return 'tsf' + d.id; })
        .attr('class', variab + ' jobTitle')
        .attr('x', function(d){ return cxScale(d.value); })
        .attr('y', 50)
        .attr("dy", ".35em")
        .attr('text-anchor', 'middle')
        .call(wrap, 80);

    d3.select('.salaryNum').html("$0");

    //Check overlapping and boundaries left and right
    d3.select('#' + variab + 'Chart').selectAll('.jobTitle').each(function(d, i){
        var bbox = d3.select(this).node().getBBox();
        var circleStart = +d3.select('#' + variab + 'Svg').select('#cf'+d.id).attr('cy')-(+d3.select('#' + variab + 'Svg').select('#cf'+d.id).attr('r')/2);
        if(bbox.y + bbox.height >= circleStart - 5) {
          d3.select(this).selectAll('tspan').attr('y', circleStart - (bbox.height + 5));
        }

        if(bbox.x + (bbox.width/2) >= width - 35 ){
          d3.select(this).selectAll('tspan').attr('x', width - (bbox.width/2));
        }

        if(bbox.x - (bbox.width/2) <= 25 && d.id != 'm3'){
          d3.select(this).selectAll('tspan').attr('x', 10 + (bbox.width/2));
        }

        var newBBox = d3.select(this).node().getBBox();
        d3.select(this.parentNode).insert('rect', ':first-child')
          .attr('id', function(d) { return 'rect' + d.id; })
          .attr('class', 'rect_jobTitle')
          .attr('x', newBBox.x - 10)
          .attr('y', newBBox.y)
          .attr('width', newBBox.width + 20)
          .attr('height', newBBox.height)
          .attr('fill', '#fff')
          .style('display', 'none');
    })

    d3.selectAll('.jobTitle').style('display', 'none');
    
}

//-------- COMMON JOB TITLES ----------//

function fillList(container, id, variab){
    var selObj = jobsDataset.filter(function( obj ) {
      return obj.key == id;
    });
    var topJobs = [];
    for(var i=1; i < 10; i++){
        var item = selObj[0].values[0][variab + '_' + i];
        if(item != undefined && item.length > 2){
            topJobs.push(selObj[0].values[0][variab + '_' + i]);
        }  
    }
    document.getElementById(container).innerHTML = "";

    d3.select('#' + container).selectAll('li')
        .data(topJobs)
        .enter()
        .append('li')
        .html(function(d){ return d;});
}

//------------ EDUCATION STACKED BAR -----------//
var causes, colors, margin, width, height, x, barSvg;
var barHeight = 45;
function drawStackedBar(){
  causes = ["Sub-BA", "Bachelor's Degree", "Graduate Degree"];
  colors = ['#6e016b', '#8c6bb1', '#bfd3e6'];
  margin = {top: 20, right: 20, bottom: 30, left: 25};
  width = d3.select('.no5').select('.boxContent').node().getBoundingClientRect().width-(margin.left+margin.right);
  height = 70;

  x = d3.scale.linear()
      .rangeRound([2, width]);

  barSvg = d3.select(".educationChart").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

}

function updateStackedBar(id){
  var selObj = jobsDataset.filter(function( obj ) {
    return obj.key == id;
  });

  var stackedData = [+selObj[0].values[0]['sub-ba'], +selObj[0].values[0]['bachelor'], +selObj[0].values[0]['graduate']];

  x.domain([0, 100]);

  var prevWidth = [0, x(stackedData[0]), x(stackedData[0]) + x(stackedData[1])];

  var bar = barSvg.selectAll("rect")
      .data(stackedData);

  var barEnter = bar.enter().append("rect")
      .attr("y", height/1.47)
      .attr("height", barHeight)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('fill', function(d, i) { return colors[i];});

  bar.transition().duration(500)
      .attr("x", function(d, i) { return prevWidth[i] })
      .attr("width", function(d) { return x(d); });

  var txt = barSvg.selectAll('.barNum')
      .data(stackedData);

  var txtEnter = txt.enter().append('text')
      .attr('class', 'barNum')
      .attr("y", margin.top + barHeight + 16 )
      .attr("dy", ".35em")
      .attr('text-anchor', 'end');

  txt.transition().duration(500)
      .attr("x", function(d, i) { return d > 6 ? prevWidth[i] + x(d) -5 : 0; }).text(function(d) { return d;})
      .attr('fill', function(d, i) { return d > 6 && i == 0 || i == 1 ? '#fff' : '333'});

  var causeLabel = barSvg.selectAll('.causeLabels')
    .data(stackedData);

  var causeEnter = causeLabel.enter().append('text')
    .attr('class', 'causeLabels')
    .attr("y", margin.top)
    .attr("dy", ".35em");

  causeLabel.attr('text-anchor', function(d, i) { return d < 10 ? 'middle' : 'end' ;}).attr('x', function(d, i) { return prevWidth[i] + x(d) - 5;}).text(function(d, i) { return causes[i]; }).call(wrap, 70);

  //Check overlapping
  var bbox1 = d3.select(causeLabel[0][0]).node().getBBox();
  var rightS1 = Number(d3.select(causeLabel[0][0]).attr('x')) + (bbox1.width / 2);

  var bbox2 = d3.select(causeLabel[0][1]).node().getBBox();
  var leftS2 = Number(d3.select(causeLabel[0][1]).attr('x')) - (bbox2.width / 2);
  var rightS2 = Number(d3.select(causeLabel[0][1]).attr('x')) + (bbox2.width / 2);

  var bbox3 = d3.select(causeLabel[0][2]).node().getBBox();
  var leftS3 = Number(d3.select(causeLabel[0][2]).attr('x')) - (bbox3.width / 2);
  
  if(rightS1 >= leftS2 || rightS2 >= leftS3){
    d3.select(causeLabel[0][1]).selectAll('tspan').attr('y', -5);
    d3.select(txt[0][1]).attr('y', height/3 - 10);
  }
  else d3.select(txt[0][1]).attr('y', margin.top + barHeight + 16);

}

//------------ NICE FRAMEWORK CATEGORIES -----------//
function fillAreas(id){
  var selObj = catsData.filter(function( obj ) {
      return obj.key == id;
    });
    d3.select(".ksas").html("");
    d3.select(".tasks").html("");
    d3.selectAll('.areaBtns').remove();
    d3.selectAll('.subCatsUl').remove();
    d3.select('.row2').style('display', 'none');
    if(selObj[0] != null){
      var areasEnter = d3.select('.areas').selectAll('areaBtns')
          .data(selObj[0].values)
          .enter()
          .append('div')
          .attr('id', function(d, i) { return 'area' + i})
          .attr('class', 'areaBtns accordion')
          .html(function(d){ return d.key;})
          .on('click', function(d,i){
            
            d3.select(this.nextSibling).classed('show', function() {
              if(d3.select(this).classed('show') == true){
                d3.selectAll('.accordion').classed('active', false);
                return false;
              }
              else {
                d3.selectAll('.subCatsUl').classed('show', false);
                d3.selectAll('.accordion').classed('active', false);
                d3.select(this.previousSibling).classed('active', true);
                return true;
              }
            });
            setBoxHeight();
          });

      d3.select('.ksas').append('div').attr('class', 'noData').html('No data');
      d3.select('.tasks').append('div').attr('class', 'noData').html('No data');

      areasEnter.each(function(d, i) {
        d3.select('.areas').insert('ul', '#area'+(i+1))
          .attr('class', 'subCatsUl')
          .selectAll('subCats')
          .data(d.values)
          .enter().append('li')
          .attr('class', 'subCatsLi')
          .attr('id', function(d) { return idStrip(d.key);})
          .html(function(d){ return d.key})
          .on('click', function(d){
            d3.select(this).classed('active', function(){
              if(d3.select(this).classed('active') == false){
                d3.select('.row2').style('display', 'block');
                d3.selectAll('.subCatsLi').classed('active', false);
                d3.selectAll('.ksa').style('display', 'none');
                d3.selectAll('.task').style('display', 'none');
                if(d3.select('.ksas').selectAll('.' + idStrip(d.key))[0][0].childNodes.length >= 0){
                  d3.select('.ksas').selectAll('.' + idStrip(d.key)).style('display', 'none');
                  d3.select('.ksas').select('.noData').style('display', 'block');
                }
                if(d3.select('.tasks').selectAll('.' + idStrip(d.key))[0][0].childNodes.length == 0){
                  d3.select('.tasks').selectAll('.' + idStrip(d.key)).style('display', 'none');
                  d3.select('.tasks').select('.noData').style('display', 'block');
                }
                else {
                  d3.select('.ksas').select('.noData').style('display', 'none');
                  d3.select('.tasks').select('.noData').style('display', 'none');
                  d3.select('.ksas').selectAll('.' + idStrip(d.key)).style('display', 'block');
                  d3.select('.tasks').selectAll('.' + idStrip(d.key)).style('display', 'block');
                }
                return true;
              }
              else {
                d3.select('.row2').style('display', 'none');
                d3.selectAll('.ksa').style('display', 'none');
                d3.selectAll('.task').style('display', 'none');
                return false;
              }
            });
            var scrollTo = document.getElementById('scrollTo');
            var targ = getOffsetTop(scrollTo);
            animatedScrollTo(
                document.body,
                targ, 
                500
            );
          });
      })

      //Append KSAs
      d3.selectAll('.subCatsLi').each(function(d,i) {
        var prevd = d;
        d3.select('.ksas').append('ul')
          .attr('class', function(d) { return 'ksa ' + idStrip(prevd.key);})
          .style('display', 'none')
          .selectAll('ksaList')
          .data(d.values)
          .enter().append('li')
          .html(function(d) { return d.ksa;});

        d3.select('.tasks').append('ul')
          .attr('class', function(d) { return 'task ' + idStrip(prevd.key);})
          .style('display', 'none')
          .selectAll('taskList')
          .data(d.values)
          .enter().append('li')
          .html(function(d) { return d.tasks;});
      });

      d3.select('.tasks').selectAll('li').each(function(d,i){
        if(d3.select(this).html() == ''){
          d3.select(this).remove();
        }
      })
      d3.select('.ksas').selectAll('li').each(function(d,i){
        if(d3.select(this).html() == ''){
          d3.select(this).remove();
        }
      })
      
    }
      
}


///----------- HELPER FUNCTIONS ------------//
function getOffsetTop( elem )
{
    var offsetTop = 0;
    do {
      if ( !isNaN( elem.offsetTop ) )
      {
          offsetTop += elem.offsetTop;
      }
    } while( elem = elem.offsetParent );
    return offsetTop;
}

//SET BOTTOM BOXES HEIGHT
function setBoxHeight(){
    var no4=document.getElementById('no4').offsetHeight;
    if(pathwayW > 1000 && pathwayW > 575){
      document.getElementById('no2').style.height=no4 + 'px';
      document.getElementById('no6').style.height=no4 + 'px';
    }
    else if(pathwayW <= 575){
      return;
    }
    else{
      document.getElementById('no6').style.height=no4 + 'px';
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

//LINES BREAK FUNCTION
function wrap(text, width) {
    text.each(function() {
      var text = d3.select(this),
          words = text.text().split(/\s+/).reverse(),
          word,
          line = [],
          lineNumber = 0,
          lineHeight = 1.1, // ems
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

function idStrip(id){
    var str = id.replace(/\s+/g, '');
    var str2 = str.replace(/\.+/g, '');
    var str3 = str2.replace(/\'+/g, '');
    var str4 = str3.toLowerCase();
    var str5 = str4.substring(0,20);
    var str6 = str5.replace(/\,+/g, '');
    var str7 = str6.replace(/\/+/g, '');
    var str8 = str7.replace(/\&+/g, '');
    var strFin = str8.replace(/\-/g, '');
    return strFin;
}

