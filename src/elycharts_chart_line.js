/***********************************************************************
 * ELYCHARTS v2.1.1
 **********************************************************************/

(function($) {

var featuresmanager = $.elycharts.featuresmanager;
var common = $.elycharts.common;

/***********************************************************************
 * CHART: LINE/BAR
 **********************************************************************/

$.elycharts.line = {
  init : function($env) {
  },
  
  draw : function(env) {
    if (common.executeIfChanged(env, ['values', 'series'])) {
      env.plots = {};
      env.axis = { x : {} };
      env.barno = 0;
    }
    
    var opt = env.opt;
    var plots = env.plots;
    var axis = env.axis;
    var paper = env.paper;
    
    var values = env.opt.values;
    var labels = env.opt.labels;
    
    // Valorizzazione di tutte le opzioni utili e le impostazioni interne di ogni grafico e dell'ambiente di lavoro
    if (common.executeIfChanged(env, ['values', 'series'])) {
      var idx = 0;
      var prevVisibleSerie = false;
      for (var serie in values) {
        var plot = {
          index : idx,
          type : false,
          visible : false
        };
        plots[serie] = plot;
        if (values[serie]) {
          var props = common.areaProps(env, 'Series', serie);
          plot.type = props.type;
          
          if (props.visible) {
            plot.visible = true;
            
            // Valori
            if (props.stacked && !(typeof props.stacked == 'string'))
              props.stacked = prevVisibleSerie;
            if (typeof props.stacked == 'undefined' || props.stacked == serie || props.stacked < 0 || !plots[props.stacked] || !plots[props.stacked].visible || plots[props.stacked].type != plot.type) {
              plot.ref = serie;
              if (props.type == 'bar')
                plot.barno = env.barno ++;
              plot.from = [];
              if (!props.cumulative)
                plot.to = values[serie];
              else {
                plot.to = [];
                var cum = 0;
                for (var i = 0; i < values[serie].length; i++)
                  plot.to.push(cum += values[serie][i]);
              }
              for (var i = 0; i < values[serie].length; i++)
                plot.from.push(0);

            } else {
              plot.ref = props.stacked;
              if (props.type == 'bar')
                plot.barno = plots[props.stacked].barno;
              plot.from = plots[props.stacked].stack;
              plot.to = [];
              var cum = 0;
              if (!props.cumulative)
                for (var i = 0; i < values[serie].length; i++)
                  plot.to.push(plot.from[i] + values[serie][i]);
              else
                for (var i = 0; i < values[serie].length; i++)
                  plot.to.push(plot.from[i] + (cum += values[serie][i]));
              plots[props.stacked].stack = plot.to;
            }
            
            plot.stack = plot.to;
            plot.max = Math.max.apply(Math, plot.from.concat(plot.to));
            plot.min = Math.min.apply(Math, plot.from.concat(plot.to));
            if (plot.min == plot.max)
              plot.max = plot.min + 1;
            
            // Assi (DEP: values, series)
            if (props.axis) {
              if (!axis[props.axis])
                axis[props.axis] = { plots : [] };
              axis[props.axis].plots.push(serie);
              if (typeof axis[props.axis].max == 'undefined')
                axis[props.axis].max = plot.max;
              else
                axis[props.axis].max = Math.max(axis[props.axis].max, plot.max);
              if (typeof axis[props.axis].min == 'undefined')
                axis[props.axis].min = plot.min;
              else
                axis[props.axis].min = Math.min(axis[props.axis].min, plot.min);
            }
            
            prevVisibleSerie = serie;
          }
        }
      }
    }
  
    // Preparazione scala assi (values, series, axis)
    if (common.executeIfChanged(env, ['values', 'series', 'axis'])) {
      for (var lidx in axis) {
        var props = common.areaProps(env, 'Axis', lidx);
        axis[lidx].props = props;
        
        if (typeof props.max != 'undefined')
          axis[lidx].max = props.max;
        if (typeof props.min != 'undefined')
          axis[lidx].min = props.min;
        /*if (props.normalize) {
          if (props.normalize == 'auto' || props.normalize == 'autony') {
            var v = Math.abs(axis[lidx].max);
            if (axis[lidx].min && Math.abs(axis[lidx].min) > v)
              v = Math.abs(axis[lidx].min);
            if (v) {
              var basev = Math.pow(10,Math.floor(Math.log(v)/Math.LN10));
              v = Math.ceil(v / basev) * basev;
              if (props.normalize == 'autony') // Si basa sulla feature: grid
                v = Math.ceil(v / opt.features.grid.ny) * opt.features.grid.ny;
              props.normalize = v;
            } else
              props.normalize = false;
          }
          if (props.normalize) {
            if (axis[lidx].max)
              axis[lidx].max = Math.ceil(axis[lidx].max / props.normalize) * props.normalize;
            if (axis[lidx].min)
              axis[lidx].min = Math.floor(axis[lidx].min / props.normalize) * props.normalize;
          }
        }*/
        if (props.normalize && props.normalize > 0) {
          var v = Math.abs(axis[lidx].max);
          if (axis[lidx].min && Math.abs(axis[lidx].min) > v)
            v = Math.abs(axis[lidx].min);
          if (v) {
            var basev = Math.floor(Math.log(v)/Math.LN10) - (props.normalize - 1);
            // NOTA: Su firefox Math.pow(10, -X) inserisce delle cifre poco significative "rumorose", meglio fare 1/Math.pow(10,X)
            basev = basev >= 0 ? Math.pow(10, basev) : 1 / Math.pow(10, -basev);
            v = Math.ceil(v / basev / (opt.features.grid.ny ? opt.features.grid.ny : 1)) * basev * (opt.features.grid.ny ? opt.features.grid.ny : 1);
            if (axis[lidx].max)
              axis[lidx].max = Math.ceil(axis[lidx].max / v) * v;
            if (axis[lidx].min)
              axis[lidx].min = Math.floor(axis[lidx].min / v) * v;
          }
        }
        if (axis[lidx].plots)
          for (var ii in axis[lidx].plots) {
            plots[axis[lidx].plots[ii]].max = axis[lidx].max;
            plots[axis[lidx].plots[ii]].min = axis[lidx].min;
          }
      }
    }

    var pieces = [];
    
    this.grid(env, pieces);
    
    // DEP: *
    var deltaX = (opt.width - opt.margins[3] - opt.margins[1]) / (labels.length > 1 ? labels.length - 1 : 1);
    var deltaBarX = (opt.width - opt.margins[3] - opt.margins[1]) / (labels.length > 0 ? labels.length : 1);

    for (var serie in values) {
      var data = values[serie];
      var props = common.areaProps(env, 'Series', serie);
      var plot = plots[serie];
      
      if (values[serie] && props.visible) {
        var deltaY = (opt.height - opt.margins[2] - opt.margins[0]) / (plot.max - plot.min);
        
        if (props.type == 'line') {
          // LINE CHART
          var linePath = [ 'LINE', [], props.rounded ];
          var fillPath = [ 'LINEAREA', [], [], props.rounded ];
          var dotPieces = [];
          
          for (var i = 0, ii = labels.length; i < ii; i++) {
            var indexProps = common.areaProps(env, 'Series', serie, i);
            
            var d = plot.to[i] > plot.max ? plot.max : (plot.to[i] < plot.min ? plot.min : plot.to[i]);
            var x = Math.round((props.lineCenter ? deltaBarX / 2 : 0) + opt.margins[3] + i * (props.lineCenter ? deltaBarX : deltaX));
            var y = Math.round(opt.height - opt.margins[2] - deltaY * (d - plot.min));
            var dd = plot.from[i] > plot.max ? plot.max : (plot.from[i] < plot.min ? plot.min : plot.from[i]);
            var yy = Math.round(opt.height - opt.margins[2] - deltaY * (dd - plot.min)) + ($.browser.msie ? 1 : 0);
            
            linePath[1].push([x, y]);
            
            if (props.fill) {
              fillPath[1].push([x, y]);
              fillPath[2].push([x, yy]);
            }
            if (indexProps.dot)
              dotPieces.push({path : [ [ 'CIRCLE', x, y, indexProps.dotProps.size ] ], attr : indexProps.dotProps}); // TODO Size e' in mezzo ad attrs
          }

          if (props.fill)
            pieces.push({ section : 'Series', serie : serie, subSection : 'Fill', path : [ fillPath ], attr : props.fillProps });
          else 
            pieces.push({ section : 'Series', serie : serie, subSection : 'Fill', path : false, attr : false });
          
          pieces.push({ section : 'Series', serie : serie, subSection : 'Plot', path : [ linePath ], attr : props.plotProps , mousearea : 'pathsteps'});
          
          if (dotPieces.length)
            pieces.push({ section : 'Series', serie : serie, subSection : 'Dot', paths : dotPieces });
          else
            pieces.push({ section : 'Series', serie : serie, subSection : 'Dot', path : false, attr : false });
          
        } else {
          pieceBar = [];
          
          // BAR CHART
          for (var i = 0, ii = labels.length; i < ii; i++) {
            if (plot.from[i] != plot.to[i]) {
              var bwid = Math.floor((deltaBarX - opt.barMargins) / env.barno);
              var bpad = bwid * (100 - props.barWidthPerc) / 200;
              var boff = opt.barMargins / 2 + plot.barno * bwid;
              
              var x1 = Math.floor(opt.margins[3] + i * deltaBarX + boff + bpad);
              var y1 = Math.round(opt.height - opt.margins[2] - deltaY * (plot.to[i] - plot.min));
              var y2 = Math.round(opt.height - opt.margins[2] - deltaY * (plot.from[i] - plot.min));
              
              pieceBar.push({path : [ [ 'RECT', x1, y1, x1 + bwid - bpad * 2, y2 ] ], attr : props.plotProps });
            }
          }
          
          if (pieceBar.length)
            pieces.push({ section : 'Series', serie : serie, subSection : 'Plot', paths: pieceBar, mousearea : 'paths' });
          else
            pieces.push({ section : 'Series', serie : serie, subSection : 'Plot', path: false, attr: false, mousearea : 'paths' });
        }
        
      } else {
        // Grafico non visibile / senza dati, deve comunque inserire i piece vuoti (NELLO STESSO ORDINE SOPRA!)
        if (props.type == 'line')
          pieces.push({ section : 'Series', serie : serie, subSection : 'Fill', path : false, attr : false });
        pieces.push({ section : 'Series', serie : serie, subSection : 'Plot', path: false, attr: false, mousearea : 'paths' });
        if (props.type == 'line')
          pieces.push({ section : 'Series', serie : serie, subSection : 'Dot', path : false, attr : false });
      }
    }
    featuresmanager.beforeShow(env, pieces);
    common.show(env, pieces);
    featuresmanager.afterShow(env, pieces);
    return pieces;
  }, 
  
  grid : function(env, pieces) {
    // DEP: axis, [=> series, values], labels, margins, width, height, labelsCenter, grid*
    if (common.executeIfChanged(env, ['values', 'series', 'axis', 'labels', 'margins', 'width', 'height', 'labelsCenter', 'features.grid'])) {
      var opt = env.opt;
      var props = env.opt.features.grid;
      var paper = env.paper;
      var axis = env.axis;
      var labels = env.opt.labels;
      var axis = env.axis;
      var deltaX = (opt.width - opt.margins[3] - opt.margins[1]) / (labels.length > 1 ? labels.length - 1 : 1);
      var deltaBarX = (opt.width - opt.margins[3] - opt.margins[1]) / (labels.length > 0 ? labels.length : 1);
      
      // Label asse X
      var paths = [];
      if (axis.x && axis.x.props.labels)
        for (var i = 0; i < labels.length; i++)
          if (axis.x.props.labelsSkip && i < axis.x.props.labelsSkip)
            labels[i] = false;
          else if (typeof labels[i] != 'boolean' || labels[i]) {
            var val = labels[i];
            if (axis.x.props.labelsFormatHandler)
              val = axis.x.props.labelsFormatHandler(val);
            var txt = (axis.x.props.prefix ? axis.x.props.prefix : "") + labels[i] + (axis.x.props.suffix ? axis.x.props.suffix : "");
            var labx = (opt.labelsCenter && axis.x.props.labelsAnchor != "start" ? Math.round(deltaBarX / 2) : 0) + opt.margins[3] + i * (opt.labelsCenter ? deltaBarX : deltaX) + (axis.x.props.labelsMargin ? axis.x.props.labelsMargin : 0);
            var laby = opt.height - opt.margins[2] + axis.x.props.labelsDistance;
            var labe = paper.text(labx, laby, txt).attr(axis.x.props.labelsProps).toBack();
            if (axis.x.props.labelsRotate)
              // Rotazione label
              labe.attr({"text-anchor" : axis.x.props.labelsRotate > 0 ? "start" : "end"}).rotate(axis.x.props.labelsRotate, labx, laby).toBack();
            else if (props.nx == 'auto' && labx + labe.getBBox().width / (axis.x.props.labelsAnchor && axis.x.props.labelsAnchor == "start" ? 1 : 2) > opt.width - opt.margins[1]) {
              // Se la label "sborda" a destra, la elimino (solo con nx = auto)
              labe.hide();
              labels[i] = false;
            } else if (props.nx == 'auto' && (!axis.x.props.labelsAnchor || axis.x.props.labelsAnchor != "start") && labx - labe.getBBox().width / 2 < 0) {
              // Se la label "sborda" a sinistra, la elimino (solo con nx = auto e labelsAnchor != start)
              labe.hide();
              labels[i] = false;
            } else if (axis.x.props.labelsAnchor && axis.x.props.labelsAnchor == "start") {
              // Label non ruotate ma con labelsAnchor
              labe.attr({"text-anchor" : "start"});
              var lw = labe.getBBox().width + (axis.x.props.labelsMargin ? axis.x.props.labelsMargin : 0) + (axis.x.props.labelsMarginRight ? axis.x.props.labelsMarginRight : 0) - (opt.labelsCenter ? deltaBarX : deltaX);
              if (axis.x.props.labelsHideCovered && lw > 0) {
                var j = i + Math.ceil(lw / (opt.labelsCenter ? deltaBarX : deltaX));
                for (; i < j && i + 1 < labels.length; i++)
                  labels[i + 1] = false;
              }
            } else if (axis.x.props.labelsHideCovered) {
              // Gestisco caso labelsHideCovered con labelsAnchor != 'start'
              var lw = (labe.getBBox().width + (axis.x.props.labelsMargin ? axis.x.props.labelsMargin : 0) + (axis.x.props.labelsMarginRight ? axis.x.props.labelsMarginRight : 0)) / 1 - (opt.labelsCenter ? deltaBarX : deltaX);
              if (lw > 0) {
                var j = i + Math.ceil(lw / (opt.labelsCenter ? deltaBarX : deltaX));
                for (; i < j && i + 1 < labels.length; i++)
                  labels[i + 1] = false;
              }
            }
            paths.push({ path : [ [ 'RELEMENT', labe ] ], attr : false });
          }
      pieces.push({ section : 'Axis', serie : 'x', subSection : 'Label', paths : paths });
          
      // Titolo Asse X
      if (axis.x && axis.x.props.title) {
        var x = opt.margins[3] + Math.floor((opt.width - opt.margins[1] - opt.margins[3]) / 2);
        var y = opt.height - opt.margins[2] + axis.x.props.titleDistance * ($.browser.msie ? axis.x.props.titleDistanceIE : 1);
        //paper.text(x, y, axis.x.props.title).attr(axis.x.props.titleProps);
        pieces.push({ section : 'Axis', serie : 'x', subSection : 'Title', path : [ [ 'TEXT', axis.x.props.title, x, y ] ], attr : axis.x.props.titleProps });
      }

      // Label + Titolo Assi L/R
      for (var jj in ['l', 'r']) {
        var j = ['l', 'r'][jj];
        if (axis[j] && axis[j].props.labels) {
          var paths = [];
          for (var i = axis[j].props.labelsSkip ? axis[j].props.labelsSkip : 0; i <= props.ny; i++) {
            var deltaY = (opt.height - opt.margins[2] - opt.margins[0]) / props.ny;
            if (j == 'r') {
              var labx = opt.width - opt.margins[1] + axis[j].props.labelsDistance;
              if (!axis[j].props.labelsProps["text-anchor"])
                axis[j].props.labelsProps["text-anchor"] = "start";
            } else {
              var labx = opt.margins[3] - axis[j].props.labelsDistance;
              if (!axis[j].props.labelsProps["text-anchor"])
                axis[j].props.labelsProps["text-anchor"] = "end";
            }
            if (axis[j].props.labelsAnchor)
              axis[j].props.labelsProps["text-anchor"] = axis[j].props.labelsAnchor;
            // NOTA: Le parentesi attorno alla divisione sono importanti per mantenere le cifre significative
            var val = (axis[j].min + (i * ((axis[j].max - axis[j].min) / props.ny)));
            if (axis[j].props.labelsFormatHandler)
              val = axis[j].props.labelsFormatHandler(val);
            if (axis[j].props.labelsCompactUnits)
              val = common.compactUnits(val, axis[j].props.labelsCompactUnits);
            var txt = (axis[j].props.prefix ? axis[j].props.prefix : "") + val + (axis[j].props.suffix ? axis[j].props.suffix : "");
            var laby = opt.height - opt.margins[2] - i * deltaY;
            //var labe = paper.text(labx, laby + (axis[j].props.labelsMargin ? axis[j].props.labelsMargin : 0), txt).attr(axis[j].props.labelsProps).toBack();
            paths.push( { path : [ [ 'TEXT', txt, labx, laby + (axis[j].props.labelsMargin ? axis[j].props.labelsMargin : 0) ] ], attr : axis[j].props.labelsProps });
          }
          pieces.push({ section : 'Axis', serie : j, subSection : 'Label', paths : paths });
        }
        if (axis[j] && axis[j].props.title) {
          if (j == 'r')
            var x = opt.width - opt.margins[1] + axis[j].props.titleDistance * ($.browser.msie ? axis[j].props.titleDistanceIE : 1);
          else
            var x = opt.margins[3] - axis[j].props.titleDistance * ($.browser.msie ? axis[j].props.titleDistanceIE : 1);
          //paper.text(x, opt.margins[0] + Math.floor((opt.height - opt.margins[0] - opt.margins[2]) / 2), axis[j].props.title).attr(axis[j].props.titleProps).attr({rotation : j == 'l' ? 270 : 90});
          var attr = common._clone(axis[j].props.titleProps);
          attr.rotation = j == 'l' ? 270 : 90
          pieces.push({ section : 'Axis', serie : j, subSection : 'Title', path : [ [ 'TEXT', axis[j].props.title, x, opt.margins[0] + Math.floor((opt.height - opt.margins[0] - opt.margins[2]) / 2) ] ], attr : attr });
        }
      }
      
      // Grid
      var gridElement = false;
      if (props.nx || props.ny) {
        var path = [], t,
          nx = props.nx == 'auto' ? (opt.labelsCenter ? labels.length : labels.length - 1) : props.nx,
          ny = props.ny,
          rowHeight = (opt.height - opt.margins[2] - opt.margins[0]) / ny,
          columnWidth = (opt.width - opt.margins[1] - opt.margins[3]) / nx,
          forceBorderX1 = typeof props.forceBorder == 'object' ? props.forceBorder[3] : props.forceBorder,
          forceBorderX2 = typeof props.forceBorder == 'object' ? props.forceBorder[1] : props.forceBorder,
          forceBorderY1 = typeof props.forceBorder == 'object' ? props.forceBorder[0] : props.forceBorder,
          forceBorderY2 = typeof props.forceBorder == 'object' ? props.forceBorder[2] : props.forceBorder,
          drawH = typeof props.draw == 'object' ? props.draw[0] : props.draw,
          drawV = typeof props.draw == 'object' ? props.draw[1] : props.draw;

        if (ny > 0)
          for (var i = 0; i < ny + 1; i++)
            if (i == 0 && forceBorderY1 || i == ny && forceBorderY2 || i > 0 && i < ny && drawH) {
              path.push(["M", opt.margins[3] - props.extra[3], opt.margins[0] + Math.round(i * rowHeight) ]);
              path.push(["L", opt.width - opt.margins[1] + props.extra[1], opt.margins[0] + Math.round(i * rowHeight)]);
            }

        for (var i = 0; i < nx + 1; i++) {
          if ((t = drawV && (props.nx != 'auto' || typeof labels[i] != 'boolean' || labels[i])) || (forceBorderX1 && i == 0) || (forceBorderX2 && i == nx)) {
            path.push(["M", opt.margins[3] + Math.round(i * columnWidth), opt.margins[0] - props.extra[0] ]); //(t ? props.extra[0] : 0)]);
            path.push(["L", opt.margins[3] + Math.round(i * columnWidth), opt.height - opt.margins[2] + props.extra[2] ]); //(t ? props.extra[2] : 0)]);
          }
        }
        
        pieces.push({ section : 'Grid', path : path.length ? path : false, attr : path.length ? props.props : false });
        
        var tpath = [];
        
        // Ticks asse X
        if (props.ticks.active && (typeof props.ticks.active != 'object' || props.ticks.active[0])) {
          for (var i = 0; i < nx + 1; i++) {
            if (props.nx != 'auto' || typeof labels[i] != 'boolean' || labels[i]) {
              tpath.push(["M", opt.margins[3] + Math.round(i * columnWidth), opt.height - opt.margins[2] - props.ticks.size[1] ]);
              tpath.push(["L", opt.margins[3] + Math.round(i * columnWidth), opt.height - opt.margins[2] + props.ticks.size[0] ]);
            }
          }
        }
        // Ticks asse L
        if (props.ticks.active && (typeof props.ticks.active != 'object' || props.ticks.active[1]))
          for (var i = 0; i < ny + 1; i++) {
            tpath.push(["M", opt.margins[3] - props.ticks.size[0], opt.margins[0] + Math.round(i * rowHeight) ]);
            tpath.push(["L", opt.margins[3] + props.ticks.size[1], opt.margins[0] + Math.round(i * rowHeight)]);
          }
        // Ticks asse R
        if (props.ticks.active && (typeof props.ticks.active != 'object' || props.ticks.active[2]))
          for (var i = 0; i < ny + 1; i++) {
            tpath.push(["M", opt.width - opt.margins[1] - props.ticks.size[1], opt.margins[0] + Math.round(i * rowHeight) ]);
            tpath.push(["L", opt.width - opt.margins[1] + props.ticks.size[0], opt.margins[0] + Math.round(i * rowHeight)]);
          }
        
        pieces.push({ section : 'Ticks', path : tpath.length ? tpath : false, attr : tpath.length ? props.ticks.props : false });
      }
    }
  }
}

})(jQuery);
