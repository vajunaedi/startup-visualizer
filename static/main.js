//Append the svg element

// Map's constant definitions
let height = 550;
let width = 1000;
let overlayWidth = 100;
let overlayHeight = 55;
let circleAmount = 5;   //Million
let pathTime = 10000;   //Time to transit between locations
let maxCircleRadius = 15;     //circle for net amounts
let positiveColor = "blue";
let negativeColor = "red";
let codeMap = d3.map();
let nameMap = d3.map();

let svg = d3.select("#map").append("svg")
            .attr("height",height)
            .attr("width",width);
let selectedCountry = null;


$(document).ready(function() {
    console.log( "Start Application" );
    $( ".company-dialog" ).dialog({
      autoOpen: false,
      show: {
        effect: "blind",
        duration: 500
      },
      hide: {
        effect: "explode",
        duration: 500
      }
    });

    // Initialize startup map
    initMap();
});


function initMap(){
    d3.queue()
        .defer(d3.json, "/countrycode")
        .await(mapCountryCode);
}


function mapCountryCode(error, countryCode){
    for(let i = 0; i < countryCode.length; i++)
        codeMap.set(countryCode[i].code, countryCode[i].alpha3);

    for(let i = 0; i < countryCode.length; i++)
        nameMap.set(countryCode[i].alpha3, countryCode[i].name);

    d3.queue()
      .defer(d3.json, "/worldmap")
      .defer(d3.json , "/countrycode")
      .defer(d3.json , "/getflow")
      .defer(d3.json , "/gettotal")
      .await(drawMap)
}


function drawMap(error, worldmap, countrycode, dealflow, totalbycountry){
    console.log("Begin drawing map..");
    if(error){
        console.log(error);
        throw error;
    }

    //Map projection
    let projection = d3.geo.mercator().translate([500,350]);

    //Create projected geopath
    let geoPath = d3.geo.path().projection(projection);

    //Convert net foreign investment into circle radius
    let amountRadiusScale = d3.scale.sqrt()
      .domain([0,d3.max(totalbycountry,function(d){return Math.abs(d.net);})])
      .range([0,maxCircleRadius]);
    //Convert net foreign investment into [0,1] , currently not used

    let amountColorScale = d3.scale.linear()
      .domain([-amountRadiusScale.range()[1],amountRadiusScale.range()[1]])
      .range([0,1]);

    //Map
    let world = topojson.feature(worldmap, {
        type: "GeometryCollection",
        geometries: worldmap.objects.countries.geometries
    });

    //Map
    map = svg.append("g").selectAll("path")
        .data(world.features)
        .enter()
        .append("path")
        .attr("class", "countries")
        .attr("d",geoPath)
        .attr("id", function(d){return codeMap.get(+d.id)});

    //Map, to create the borders, notice only borders between countries are drawn
    svg.append("g").append("path")
        .attr("class", "borders")
        .attr("d",geoPath(topojson.mesh(worldmap, worldmap.objects.countries, function(a, b) { return a !== b; })));

    //A  background for people to click on and cancels any filtering
    svg.append("g").append("rect")
        .attr("height",height)
        .attr("width",width)
        .attr("opacity","0")
        .on("click",clickbackground);

     //Create group for each line of circles based on the dealflow dataset
    deals = svg.append("g").attr("class","transit-circles").selectAll("g")
                .data(dealflow)
                .enter()
                .append("g")
                .attr("class",function(d){return d.origin + " " + d.destination;});

    //Create line of circles for each group, ideally integrated into the enter state
    deals.each(function(d){
        let originCentroid;
        let destinationCentroid;
        let origin = d3.select("#" + d.origin);
        let destination = d3.select("#" + d.destination);
        origin.each(function(d){
            originCentroid = geoPath.centroid(d);
        });
        destination.each(function(d){
            destinationCentroid = geoPath.centroid(d);
        });
        //Rather complicated way of drawing the line of circles and distribute them evenly
        var numCircle = Math.ceil(+d.amount/circleAmount);
        var randPos = Math.random();
        for(i = 0 ; i < numCircle ; i++){
            if((typeof destinationCentroid !== "undefined") && (typeof originCentroid !== "undefined")) {
                let circle = d3.select(this).append("circle");

                circle
                  .attr("r", "1.5")
                  .attr("fill", "rgba(0,0,0,1)")
                circle
                  .attr("cx", function (d) {
                      return originCentroid[0] + (i+randPos) * (destinationCentroid[0] - originCentroid[0]) / numCircle;
                  })
                  .attr("cy", function (d) {
                      return originCentroid[1] + (i+randPos) * (destinationCentroid[1] - originCentroid[1]) / numCircle;
                  })
                  .transition()
                  .ease("linear")
                  .duration((numCircle - (i-randPos)) * pathTime / numCircle)
                  .attr('cx', destinationCentroid[0])
                  .attr('cy', destinationCentroid[1])
                  .each("end",repeat);

                  function repeat(){
                    d3.select(this)
                    .attr('cx', originCentroid[0])
                    .attr('cy', originCentroid[1])
                    .transition()
                    .ease("linear")
                    .duration(pathTime)
                    .attr('cx', destinationCentroid[0])
                    .attr('cy', destinationCentroid[1])
                    .each("end", repeat);
                  }

            }
        }
    });
      //Create net investment circle for each country based on the totalbycountry dataset passed in
      //i.e. big circles
      countrytotal = svg.append("g").attr("class","country-circles").selectAll("circle")
        .data(totalbycountry)
        .enter()
        .append("circle")
        .attr("class",function(d){return d.country});

        //Configure each net investment circle
      //Note there are click, mouseover, mouseout and mousemove events built in
      countrytotal.each(function(d){
        let centroid;
        let origin = d3.select("#" + d.country);
        origin.each(function(d){centroid = geoPath.centroid(d);});
        if(typeof centroid !== "undefined") {
            d3.select(this)
                .attr("cx", centroid[0])
                .attr("cy", centroid[1])
                .attr("r", function (d) {
                    return amountRadiusScale(Math.abs(d.net));
                })
                .attr("fill", function (d) {
                    if (d.net >= 0) {
                        return positiveColor
                    } else {
                        return negativeColor
                    }
                })
                .on("click", click);

            // .on("mouseover",mouseover)
            // .on("mouseout",mouseout)
            // .on("mousemove",mousemove);
        };
      });
}

let country = "svg";

function click(d){
  // Clicking the country will display the world cloud and parallel coordinate
  $( ".company-dialog" ).dialog( "close" );
  createWordCloud(d.country);
  createParCoords(d.country);
  let selectedCountry = nameMap.get(d.country);
  let displayString = "Startup Information of: " + selectedCountry;
  $(".country-info").text(displayString);

  //Filtering
  d3.selectAll(".transit-circles g circle").each(function(d){
    d3.select(this).attr("opacity",1);
  });
  //If the same country circle is clicked a second time (tracked by the "country" variable), return to top view
  if(country != d.country){
    country = d.country;
    d3.selectAll(".transit-circles g:not(." + country + ") circle").each(function(d){
      d3.select(this).attr("opacity",0);
    });
    //Select all country circles and set to 0 opacity
    d3.selectAll(".country-circles circle:not(." + country + ")").each(function(d){
      var obj = d3.select(this)
        .attr("opacity",0);
    });
    //Select all rellavant countries and set to 1 opacity
    d3.selectAll(".transit-circles g." + country).each(function(d){
      //Super crude method... please help think how to improve this, maybe a more advanced not selection?
      var otherCountry = ".country-circles circle."+d3.select(this).attr("class").replace(country,"").replace(" ","");
      d3.selectAll(otherCountry).each(function(d){
        var obj = d3.select(this).attr("opacity",1);
      });
    });
    d3.selectAll(".country-circles circle." + country).each(function(d){
      d3.select(this).attr("opacity",1);
    });
  }
  else{
    d3.selectAll(".country-circles circle").each(function(d){
      d3.select(this).attr("opacity",1);
    });
    country = "svg"
  }
}

function clickbackground(d){
  //When users click the empty background created earlier, view reverts to the original
  d3.selectAll(".transit-circles g circle").each(function(d){
    d3.select(this).attr("opacity",1);
  });
  d3.selectAll(".country-circles circle").each(function(d){
    d3.select(this).attr("opacity",1);
  });
  country = "svg"
}

function createWordCloud(countryChoice) {
    let color = d3.scale.linear()
            .domain([0,1,2,3,4,5,6,10,15,20,100])
            .range(["#ddd", "#ccc", "#bbb", "#aaa", "#999", "#888", "#777", "#666", "#555", "#444", "#333", "#222"]);

    function draw(categories) {
        console.log("Begin drawing wordcloud");

        // Remove previous wordcloud if there is any
        d3.select(".wordcloud").remove();

        d3.select("#wordcloud-container").append("svg")
                .attr("width", 900)
                .attr("height", 300)
                .attr("class", "wordcloud")
                .append("g")
                // without the transform, words words would get cutoff to the left and top, they would
                // appear outside of the SVG area
                .attr("transform", "translate(300,150)")
                .selectAll("text")
                .data(categories)
                .enter().append("text")
                .style("font-size", function(d) { return d.size + "px"; })
                .style("fill", function(d, i) { return color(i); })
                .attr("transform", function(d) {
                    return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
                })
                .text(function(d) { return d.text; })
                .on("click", function (d, i){
                  $( ".company-dialog" ).dialog( "close" );
                  let category = d.text;
                  let requestString = '/most_popular_companies?country='
                      + countryChoice + '&category=' + category;
                  d3.json(requestString, function(error, result) {
                    // Display the top 3 companies of the given category
                    $(".company-dialog-text").text("Most popular company in this category: ");
                    let company_list = $(".company-dialog-text").append('<ul></ul>').find('ul');

                    for (i in result) {
                        let company_link = $('<a />');
                        company_link.attr('href', result[i].homepage_url);
                        company_link.attr('target', '_blank');
                        company_link.text(result[i].company_name);

                        inside_list = company_list.append('<li></li>').find('li').last();
                        inside_list.append(company_link);
                        company_list.append(inside_list);
                    }

                    $( ".company-dialog" ).dialog( "open" );
                  });
              });
    }

    // request the data
    d3.json("/word_cloud?country=" + countryChoice, function (error, categories) {
        d3.layout.cloud()
        .size([900, 300])
        .words(categories)
        .rotate(0)
        .fontSize(function(d) { return d.frequency; })
        .on("end", draw)
        .start();
    });
    return false;
}

function createParCoords(countryChoice){
    // First, remove the previous parallel coordinate if there is any
    $(".parcoords").empty();

    console.log("Begin parallel coordinates..");

    // Parallel Coordinate creation begins
    let requestString = "/par_coords?country=" + countryChoice;
    d3.json(requestString, function(data) {
              //keep only the important columns
              let filtered_data = data.map(function(d) {
                return {
                  investment_type: d.investment_type,
                  amount_invested: + d.raised_amount_usd,
                  investor_type: d.investor_type,
                  foreign_vs_local: (d.country_code == d.investor_country_code)?"local":"foreign"
                }
              });
              //dimensions of each axis
              let dimensions = {"investment_type": {
                              title: 'investment type',
                              type: 'string',
                              index: 0
                              // yscale: 'linear'
                            },
                            "amount_invested": {
                              title: 'amount invested (USD)',
                              type: 'number',
                              index: 1
                              // yscale: 'ordinal'
                            },
                            "investor_type": {
                              title: 'investor type',
                              type: 'string',
                              index: 2
                              // yscale: 'ordinal'
                            },
                          "foreign_vs_local": {
                            title: 'foreign vs local investors',
                            type: 'string',
                            index: 3
                          }};

               let colourIndex = d3.scale.linear()
                .domain([0, 11])
                .range(['#FDC33E', '#A6C9B1'])
                .interpolate(d3.interpolateLab);
               let it = 0;
               let color = function(d){return colourIndex((it++)%12)};
               let parcoords = d3.parcoords()(".parcoords")
                 .data(filtered_data)
                 .color(color)
                 .dimensions(dimensions)
                 .bundlingStrength(1)
                 .nullValueSeparator('bottom')
                 .showControlPoints(true)
                 .render()
                 .createAxes()
                 .alpha(0.5)
                 .brushMode("1D-axes")
                 .mode("queue")
                 .interactive();
               parcoords.svg.selectAll("text")
               .style("font", "10px sans-serif");
            });
}
