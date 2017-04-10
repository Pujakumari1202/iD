import * as d3 from 'd3';
import { t, textDirection } from '../../util/locale';
import { utilRebind } from '../../util/rebind';
import { icon, pointBox, pad, selectMenuItem, transitionTime } from './helper';


export function uiIntroPoint(context, reveal) {
    var dispatch = d3.dispatch('done'),
        timeouts = [],
        intersection = [-85.63279, 41.94394],
        building = [-85.632422, 41.944045],
        cafePreset = context.presets().item('amenity/cafe'),
        pointId = null;


    var chapter = {
        title: 'intro.points.title'
    };


    function timeout(f, t) {
        timeouts.push(window.setTimeout(f, t));
    }


    function eventCancel() {
        d3.event.stopPropagation();
        d3.event.preventDefault();
    }


    function addPoint() {
        context.history().reset('initial');

        var msec = transitionTime(intersection, context.map().center());
        if (msec) { reveal(null, null, { duration: 0 }); }
        context.map().zoom(19).centerEase(intersection, msec);

        timeout(function() {
            var tooltip = reveal('button.add-point',
                t('intro.points.add_point', { button: icon('#icon-point', 'pre-text') }));

            pointId = null;

            tooltip.selectAll('.tooltip-inner')
                .insert('svg', 'span')
                .attr('class', 'tooltip-illustration')
                .append('use')
                .attr('xlink:href', '#poi-images');

            context.on('enter.intro', function(mode) {
                if (mode.id !== 'add-point') return;
                continueTo(placePoint);
            });
        }, msec + 100);

        function continueTo(nextStep) {
            context.on('enter.intro', null);
            nextStep();
        }
    }


    function placePoint() {
        if (context.mode().id !== 'add-point') {
            return chapter.restart();
        }

        var pointBox = pad(building, 150, context);
        reveal(pointBox, t('intro.points.place_point'));

        context.map().on('move.intro drawn.intro', function() {
            pointBox = pad(building, 150, context);
            reveal(pointBox, t('intro.points.place_point'), { duration: 0 });
        });

        context.on('enter.intro', function(mode) {
            if (mode.id !== 'select') return chapter.restart();
            continueTo(searchPreset);
        });

        function continueTo(nextStep) {
            context.map().on('move.intro drawn.intro', null);
            context.on('enter.intro', null);
            nextStep();
        }
    }


    function searchPreset() {
        if (context.mode().id !== 'select') {
            return chapter.restart();
        }

        pointId = context.mode().selectedIDs()[0];

        context.on('exit.intro', function() {
            return chapter.restart();
        });

        d3.select('.preset-search-input')
            .on('keyup.intro', checkPresetSearch);

        timeout(function() {
            reveal('.preset-search-input',
                t('intro.points.search_cafe', { preset: cafePreset.name() })
            );
        }, 500);
    }


    function checkPresetSearch() {
        var first = d3.select('.preset-list-item:first-child');

        if (first.classed('preset-amenity-cafe')) {
            reveal(first.select('.preset-list-button').node(),
                t('intro.points.choose_cafe', { preset: cafePreset.name() }),
                { duration: 300 }
            );

            d3.select('.preset-search-input')
                .on('keydown.intro', eventCancel, true)
                .on('keyup.intro', null);

            context.history().on('change.intro', function() {
                continueTo(aboutFeatureEditor);
            });
        }

        function continueTo(nextStep) {
            context.on('exit.intro', null);
            context.history().on('change.intro', null);
            d3.select('.preset-search-input').on('keydown.intro', null);
            nextStep();
        }
    }


    function aboutFeatureEditor() {
        context.on('exit.intro', function() {
            return chapter.restart();
        });

        timeout(function() {
            reveal('.entity-editor-pane', t('intro.points.feature_editor'), {
                tooltipClass: 'intro-points-describe',
                buttonText: t('intro.ok'),
                buttonCallback: function() { continueTo(addName); }
            });
        }, 400);

        function continueTo(nextStep) {
            context.on('exit.intro', null);
            nextStep();
        }
    }


    function addName() {
        context.on('exit.intro', function() {
            return chapter.restart();
        });

        context.history().on('change.intro', function() {
            continueTo(addCloseEditor);
        });

        timeout(function() {
            reveal('.entity-editor-pane', t('intro.points.add_name'),
                { tooltipClass: 'intro-points-describe' }
            );
        }, 400);

        function continueTo(nextStep) {
            context.on('exit.intro', null);
            context.history().on('change.intro', null);
            nextStep();
        }
    }


    function addCloseEditor() {
        context.on('exit.intro', function() {
            continueTo(reselectPoint);
        });

        reveal('.entity-editor-pane',
            t('intro.points.add_close', { button: icon('#icon-apply', 'pre-text') })
        );

        function continueTo(nextStep) {
            context.on('exit.intro', null);
            nextStep();
        }
    }


    function reselectPoint() {
        if (!pointId) return chapter.restart();
        var entity = context.hasEntity(pointId);
        if (!entity) return chapter.restart();

        var msec = transitionTime(entity.loc, context.map().center());
        if (msec) { reveal(null, null, { duration: 0 }); }
        context.map().centerEase(entity.loc, msec);

        timeout(function() {
            var box = pointBox(entity.loc, context);
            reveal(box, t('intro.points.reselect'));

            context.map().on('move.intro drawn.intro', function() {
                var entity = context.hasEntity(pointId);
                if (!entity) return chapter.restart();
                var box = pointBox(entity.loc, context);
                reveal(box, t('intro.points.reselect'), { duration: 0 });
            });

            context.on('enter.intro', function(mode) {
                if (mode.id !== 'select') return;
                continueTo(updatePoint);
            });

        }, msec + 100);

        function continueTo(nextStep) {
            context.map().on('move.intro drawn.intro', null);
            context.on('enter.intro', null);
            nextStep();
        }
    }


    function updatePoint() {
        context.on('exit.intro', function() {
            continueTo(reselectPoint);
        });

        context.history().on('change.intro', function() {
            continueTo(updateCloseEditor);
        });

        timeout(function() {
            reveal('.entity-editor-pane', t('intro.points.update'),
                { tooltipClass: 'intro-points-describe' }
            );
        }, 400);

        function continueTo(nextStep) {
            context.on('exit.intro', null);
            context.history().on('change.intro', null);
            nextStep();
        }
    }


    function updateCloseEditor() {
        if (context.mode().id !== 'select') {
            return continueTo(reselectPoint);
        }

        context.on('exit.intro', function() {
            continueTo(rightClickPoint);
        });

        timeout(function() {
            reveal('.entity-editor-pane',
                t('intro.points.update_close', { button: icon('#icon-apply', 'pre-text') })
            );
        }, 500);

        function continueTo(nextStep) {
            context.on('exit.intro', null);
            nextStep();
        }
    }


    function rightClickPoint() {
        if (!pointId) return chapter.restart();
        var entity = context.hasEntity(pointId);
        if (!entity) return chapter.restart();

        var box = pointBox(entity.loc, context);
        reveal(box, t('intro.points.rightclick'));

        context.map().on('move.intro drawn.intro', function() {
            var entity = context.hasEntity(pointId);
            if (!entity) return chapter.restart();
            var box = pointBox(entity.loc, context);
            reveal(box, t('intro.points.rightclick'), { duration: 0 });
        });

        context.on('enter.intro', function(mode) {
            if (mode.id !== 'select') return;
            var ids = context.selectedIDs();
            if (ids.length !== 1 || ids[0] !== pointId) return;

            timeout(function() {
                var node = selectMenuItem('delete').node();
                if (!node) return;
                continueTo(enterDelete);
            }, 300);  // after menu visible
        });

        function continueTo(nextStep) {
            context.on('enter.intro', null);
            context.map().on('move.intro drawn.intro', null);
            nextStep();
        }
    }


    function enterDelete() {
        if (!pointId) return chapter.restart();
        var entity = context.hasEntity(pointId);
        if (!entity) return chapter.restart();

        var node = d3.select('.edit-menu-item-delete, .radial-menu-item-delete').node();
        if (!node) {
            return continueTo(rightClickPoint);
        } else {
            var rect = context.surfaceRect();
            var point = context.curtainProjection(entity.loc);
            var box = {
                left: point[0] + rect.left - 40,
                top: point[1] + rect.top - 60,
                width: 150,
                height: 150
            };
            reveal(box,
                t('intro.points.delete', { button: icon('#operation-delete', 'pre-text') })
            );
        }

        context.on('exit.intro', function() {
            if (!pointId) return chapter.restart();
            var entity = context.hasEntity(pointId);
            if (entity) return continueTo(rightClickPoint);  // point still exists
        });

        context.history().on('change.intro', function(changed) {
            if (changed.deleted().length)
                continueTo(undo);
        });

        function continueTo(nextStep) {
            context.history().on('change.intro', null);
            context.on('exit.intro', null);
            nextStep();
        }
    }


    function undo() {
        context.history().on('change.intro', function() {
            continueTo(play);
        });

        var iconName = '#icon-' + (textDirection === 'rtl' ? 'redo' : 'undo');
        reveal('#bar button.undo-button',
            t('intro.points.undo', { button: icon(iconName, 'pre-text') })
        );

        function continueTo(nextStep) {
            context.history().on('change.intro', null);
            nextStep();
        }
    }


    function play() {
        reveal('.intro-nav-wrap .chapter-area',
            t('intro.points.play', { next: t('intro.areas.title') }), {
                buttonText: t('intro.ok'),
                buttonCallback: function() {
                    dispatch.call('done');
                    reveal('#id-container');
                }
            }
        );
    }


    chapter.enter = function() {
        addPoint();
    };


    chapter.exit = function() {
        timeouts.forEach(window.clearTimeout);
        context.on('exit.intro', null);
        context.on('enter.intro', null);
        context.map().on('move.intro drawn.intro', null);
        context.history().on('change.intro', null);
        d3.select('.preset-search-input').on('keydown.intro keyup.intro', null);
    };


    chapter.restart = function() {
        chapter.exit();
        chapter.enter();
    };


    return utilRebind(chapter, dispatch, 'on');
}
