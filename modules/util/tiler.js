import { range as d3_range } from 'd3-array';
import { geoMercatorRaw as d3_geoMercatorRaw } from 'd3-geo';
import { geoExtent, geoScaleToZoom } from '../geo';


export function utilTiler() {
    var _size = [256, 256];
    var _scale = 256;
    var _tileSize = 256;
    var _zoomExtent = [0, 20];
    var _translate = [_size[0] / 2, _size[1] / 2];
    var _margin = 0;
    var _skipNullIsland = false;


    function clamp(num, min, max) {
        return Math.max(min, Math.min(num, max));
    }


    function nearNullIsland(tile) {
        var x = tile[0];
        var y = tile[1];
        var z = tile[2];
        if (z >= 7) {
            var center = Math.pow(2, z - 1);
            var width = Math.pow(2, z - 6);
            var min = center - (width / 2);
            var max = center + (width / 2) - 1;
            return x >= min && x <= max && y >= min && y <= max;
        }
        return false;
    }


    function tiler() {
        var z = geoScaleToZoom(_scale / (2 * Math.PI), _tileSize);
        var z0 = clamp(Math.round(z), _zoomExtent[0], _zoomExtent[1]);
        var tileMin = 0;
        var tileMax = Math.pow(2, z0) - 1;
        var log2ts = Math.log(_tileSize) * Math.LOG2E;
        var k = Math.pow(2, z - z0 + log2ts);
        var origin = [
            (_translate[0] - _scale / 2) / k,
            (_translate[1] - _scale / 2) / k
        ];

        var cols = d3_range(
            clamp(Math.floor(-origin[0]) - _margin,               tileMin, tileMax + 1),
            clamp(Math.ceil(_size[0] / k - origin[0]) + _margin,  tileMin, tileMax + 1)
        );
        var rows = d3_range(
            clamp(Math.floor(-origin[1]) - _margin,               tileMin, tileMax + 1),
            clamp(Math.ceil(_size[1] / k - origin[1]) + _margin,  tileMin, tileMax + 1)
        );

        var tiles = [];
        for (var i = 0; i < rows.length; i++) {
            var y = rows[i];
            for (var j = 0; j < cols.length; j++) {
                var x = cols[j];

                if (i >= _margin && i <= rows.length - _margin &&
                    j >= _margin && j <= cols.length - _margin) {
                    tiles.unshift([x, y, z0]);  // tiles in view at beginning
                } else {
                    tiles.push([x, y, z0]);     // tiles in margin at the end
                }
            }
        }

        tiles.translate = origin;
        tiles.scale = k;

        return tiles;
    }


    /**
     * getTiles() returns an array of tiles that cover the map view
     */
    tiler.getTiles = function(projection) {
        var origin = [
            projection.scale() * Math.PI - projection.translate()[0],
            projection.scale() * Math.PI - projection.translate()[1]
        ];

        this
            .size(projection.clipExtent()[1])
            .scale(projection.scale() * 2 * Math.PI)
            .translate(projection.translate());

        var tiles = tiler();
        var ts = tiles.scale;

        return tiles
            .map(function(tile) {
                if (_skipNullIsland && nearNullIsland(tile)) {
                    return false;
                }
                var x = tile[0] * ts - origin[0];
                var y = tile[1] * ts - origin[1];
                return {
                    id: tile.toString(),
                    xyz: tile,
                    extent: geoExtent(
                        projection.invert([x, y + ts]),
                        projection.invert([x + ts, y])
                    )
                };
            }).filter(Boolean);
    };


    /**
     * getGeoJSON() returns a FeatureCollection for debugging tiles
     */
    tiler.getGeoJSON = function(projection) {
        var features = tiler.getTiles(projection).map(function(tile) {
            return {
                type: 'Feature',
                properties: {
                    id: tile.id,
                    name: tile.id
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [ tile.extent.polygon() ]
                }
            };
        });

        return {
            type: 'FeatureCollection',
            features: features
        };
    };


    tiler.tileSize = function(val) {
        if (!arguments.length) return _tileSize;
        _tileSize = val;
        return tiler;
    };


    tiler.zoomExtent = function(val) {
        if (!arguments.length) return _zoomExtent;
        _zoomExtent = val;
        return tiler;
    };


    tiler.size = function(val) {
        if (!arguments.length) return _size;
        _size = val;
        return tiler;
    };


    tiler.scale = function(val) {
        if (!arguments.length) return _scale;
        _scale = val;
        return tiler;
    };


    tiler.translate = function(val) {
        if (!arguments.length) return _translate;
        _translate = val;
        return tiler;
    };


    // number to extend the rows/columns beyond those covering the viewport
    tiler.margin = function(val) {
        if (!arguments.length) return _margin;
        _margin = +val;
        return tiler;
    };


    tiler.skipNullIsland = function(val) {
        if (!arguments.length) return _skipNullIsland;
        _skipNullIsland = val;
        return tiler;
    };


    return tiler;
}

// Returns an array of four tiles representing the given `tile` at the next higher
// zoom level. Note that tile rows and columns are >=0 from the top left while
// the extent is in geographic coordinates.
utilTiler.subdivide = function(tile) {

    function geo2Proj(lon, lat) {
        return d3_geoMercatorRaw(lon * Math.PI / 180, lat * Math.PI / 180);
    }

    function proj2Geo(x, y) {
        var rad = d3_geoMercatorRaw.invert(x, y);
        return [rad[0] * 180 / Math.PI, rad[1] * 180 / Math.PI];
    }

    // must use the projected bounding box
    var pMin = geo2Proj(tile.extent[0][0], tile.extent[0][1]);
    var pMax = geo2Proj(tile.extent[1][0], tile.extent[1][1]);

    // width and height should be the same for square tiles
    var w = pMax[0] - pMin[0];
    var h = pMax[1] - pMin[1];

    var x = tile.xyz[0];
    var y = tile.xyz[1];
    var z = tile.xyz[2];

    var subtiles = [
        // top left
        {
            xyz: [
                x * 2,
                y * 2,
                z + 1
            ],
            extent: geoExtent(
                proj2Geo(pMin[0], pMin[1] + h/2),
                proj2Geo(pMin[0] + w/2, pMin[1] + h)
            )
        },
        // bottom left
        {
            xyz: [
                x * 2,
                y * 2 + 1,
                z + 1
            ],
            extent: geoExtent(
                proj2Geo(pMin[0], pMin[1]),
                proj2Geo(pMin[0] + w/2, pMin[1] + h/2)
            )
        },
        // top right
        {
            xyz: [
                x * 2 + 1,
                y * 2,
                z + 1
            ],
            extent: geoExtent(
                proj2Geo(pMin[0] + w/2, pMin[1] + h/2),
                proj2Geo(pMin[0] + w, pMin[1] + h)
            )
        },
        // bottom right
        {
            xyz: [
                x * 2 + 1,
                y * 2 + 1,
                z + 1
            ],
            extent: geoExtent(
                proj2Geo(pMin[0] + w/2, pMin[1]),
                proj2Geo(pMin[0] + w, pMin[1] + h/2)
            )
        }
    ];

    subtiles.forEach(function(tile) {
        tile.id = tile.xyz.toString();
    });

    return subtiles;
};
