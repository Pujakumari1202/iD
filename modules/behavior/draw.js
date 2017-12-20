import { dispatch as d3_dispatch } from 'd3-dispatch';

import {
    event as d3_event,
    mouse as d3_mouse,
    select as d3_select,
    touches as d3_touches
} from 'd3-selection';

import { d3keybinding as d3_keybinding } from '../lib/d3.keybinding.js';
import { behaviorEdit } from './edit';
import { behaviorHover } from './hover';
import { behaviorTail } from './tail';

import {
    geoChooseEdge,
    geoEuclideanDistance,
    geoViewportEdge
} from '../geo';

import { utilRebind } from '../util/rebind';


var _usedTails = {};
var _disableSpace = false;
var _lastSpace = null;


export function behaviorDraw(context) {
    var dispatch = d3_dispatch(
        'move', 'click', 'clickWay', 'clickNode', 'undo', 'cancel', 'finish'
    );

    var keybinding = d3_keybinding('draw');

    var hover = behaviorHover(context)
        .altDisables(true)
        .on('hover', context.ui().sidebar.hover);
    var tail = behaviorTail();
    var edit = behaviorEdit(context);

    var closeTolerance = 4;
    var tolerance = 12;
    var _mouseLeave = false;
    var _lastMouse = null;


    function datum() {
        if (d3_event.altKey) return {};

        var element;
        if (d3_event.type === 'keydown') {
            element = _lastMouse && _lastMouse.target;
        } else {
            element = d3_event.target;
        }

        // When drawing, connect only to things classed as targets..
        // (this excludes area fills and active drawing elements)
        var selection = d3_select(element);
        if (selection.classed('target')) return {};

        var d = selection.datum();
        return (d && d.id && context.hasEntity(d.id)) || {};
    }


    function mousedown() {

        function point() {
            var p = context.container().node();
            return touchId !== null ? d3_touches(p).filter(function(p) {
                return p.identifier === touchId;
            })[0] : d3_mouse(p);
        }

        var element = d3_select(this);
        var touchId = d3_event.touches ? d3_event.changedTouches[0].identifier : null;
        var t1 = +new Date();
        var p1 = point();

        element.on('mousemove.draw', null);

        d3_select(window).on('mouseup.draw', function() {
            var t2 = +new Date();
            var p2 = point();
            var dist = geoEuclideanDistance(p1, p2);

            element.on('mousemove.draw', mousemove);
            d3_select(window).on('mouseup.draw', null);

            if (dist < closeTolerance || (dist < tolerance && (t2 - t1) < 500)) {
                // Prevent a quick second click
                d3_select(window).on('click.draw-block', function() {
                    d3_event.stopPropagation();
                }, true);

                context.map().dblclickEnable(false);

                window.setTimeout(function() {
                    context.map().dblclickEnable(true);
                    d3_select(window).on('click.draw-block', null);
                }, 500);

                click();
            }
        }, true);
    }


    function mousemove() {
        _lastMouse = d3_event;
        dispatch.call('move', this, datum());
    }


    function mouseenter() {
        _mouseLeave = false;
    }


    function mouseleave() {
        _mouseLeave = true;
    }


    function click() {
        var trySnap = geoViewportEdge(context.mouse(), context.map().dimensions()) === null;
        if (trySnap) {
            // If we're not at the edge of the viewport, try to snap..
            // See also: `modes/drag_node.js doMove()`
            var d = datum();

            // Snap to a node
            if (d.type === 'node') {
                dispatch.call('clickNode', this, d);
                return;

            // Snap to a way
            } else if (d.type === 'way') {
                var choice = geoChooseEdge(context.childNodes(d), context.mouse(), context.projection);
                var edge = [d.nodes[choice.index - 1], d.nodes[choice.index]];
                dispatch.call('clickWay', this, choice.loc, edge);
                return;
            }
        }

        dispatch.call('click', this, context.map().mouseCoordinates());
    }


    function space() {
        d3_event.preventDefault();
        d3_event.stopPropagation();

        var currSpace = context.mouse();
        if (_disableSpace && _lastSpace) {
            var dist = geoEuclideanDistance(_lastSpace, currSpace);
            if (dist > tolerance) {
                _disableSpace = false;
            }
        }

        if (_disableSpace || _mouseLeave || !_lastMouse) return;

        // user must move mouse or release space bar to allow another click
        _lastSpace = currSpace;
        _disableSpace = true;

        d3_select(window).on('keyup.space-block', function() {
            d3_event.preventDefault();
            d3_event.stopPropagation();
            _disableSpace = false;
            d3_select(window).on('keyup.space-block', null);
        });

        click();
    }


    function backspace() {
        d3_event.preventDefault();
        dispatch.call('undo');
    }


    function del() {
        d3_event.preventDefault();
        dispatch.call('cancel');
    }


    function ret() {
        d3_event.preventDefault();
        dispatch.call('finish');
    }


    function draw(selection) {
        context.install(hover);
        context.install(edit);

        if (!context.inIntro() && !_usedTails[tail.text()]) {
            context.install(tail);
        }

        keybinding
            .on('⌫', backspace)
            .on('⌦', del)
            .on('⎋', ret)
            .on('↩', ret)
            .on('space', space)
            .on('⌥space', space);

        selection
            .on('mouseenter.draw', mouseenter)
            .on('mouseleave.draw', mouseleave)
            .on('mousedown.draw', mousedown)
            .on('mousemove.draw', mousemove);

        d3_select(document)
            .call(keybinding);

        return draw;
    }


    draw.off = function(selection) {
        context.ui().sidebar.hover.cancel();
        context.uninstall(hover);
        context.uninstall(edit);

        if (!context.inIntro() && !_usedTails[tail.text()]) {
            context.uninstall(tail);
            _usedTails[tail.text()] = true;
        }

        selection
            .on('mouseenter.draw', null)
            .on('mouseleave.draw', null)
            .on('mousedown.draw', null)
            .on('mousemove.draw', null);

        d3_select(window)
            .on('mouseup.draw', null);
            // note: keyup.space-block, click.draw-block should remain

        d3_select(document)
            .call(keybinding.off);
    };


    draw.tail = function(_) {
        tail.text(_);
        return draw;
    };


    return utilRebind(draw, dispatch, 'on');
}
