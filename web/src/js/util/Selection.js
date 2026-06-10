import L from "leaflet";
import { S } from "../Squaremap.js";

class Selection {
    /** @type {LatLngWithCircle[]} */
    points;
    /** @type {L.Polygon} */
    polygon;
    /** @type {LatLngWithCircle} */
    selectedPoint;
    /** @type {boolean} */
    is_dragging;
    /** @type {L.Map} */
    map;

    constructor() {
        this.map = S.map;
        this.is_dragging = false;
        this.points = [];
        this.polygon = new L.Polygon([]);
    }

    load() {
        this.map.on("click", this.onMapClick, this);
        this.map.on("mouseup", this.onMouseUp, this);
        this.map.on("mousemove", this.onMouseMove, this);
        this.polygon.addTo(this.map);
        for (const point of this.points) {
            point.circle.addTo(this.map);
        }
    }

    unload() {
        this.map.removeEventListener("click", this.onMapClick, this);
        this.map.removeEventListener("mouseup", this.onMouseUp, this);
        this.map.removeEventListener("mousemove", this.onMouseMove, this);
        this.polygon.removeFrom(this.map);
        for (const point of this.points) {
            point.circle.removeFrom(this.map);
        }
    }

    /**
     * @param {L.LeafletMouseEvent} event
     */
    onMapClick(event) {
        if (this.is_dragging) {
            this.is_dragging = false;
            return;
        }
        let i = -1;
        let min_dist = Number.MAX_VALUE;
        // find closest edge
        for (let j = 0; j < this.points.length; j++) {
            let dist = distance(event.latlng, this.points[j], this.points[(j + 1) % this.points.length]);
            if (dist < min_dist) {
                min_dist = dist;
                i = j;
            }
        }
        let point = new LatLngWithCircle(event.latlng.lat, event.latlng.lng, event.latlng.alt)
        // event for dragging and removing point
        point.circle.addEventListener("mousedown", (event) => {
            if (event.originalEvent.button === 1) {
                const i = this.points.indexOf(point);
                point.circle.removeFrom(this.map);
                this.points.splice(i, 1);
                this.updatePolygon();
            } else {
                this.map.dragging.disable();
                this.is_dragging = true;
                this.selectedPoint = point;
            }
        })
        point.circle.addTo(this.map);
        this.points.splice(i + 1, 0, point);
        this.updatePolygon();
    }

    onMouseUp() {
        this.map.dragging.enable();
        this.selectedPoint = undefined;
    }

    /**
     * @param {L.LeafletMouseEvent} event
     */
    onMouseMove(event) {
        if (this.selectedPoint) {
            this.selectedPoint.setLatLng(event.latlng);
            this.updatePolygon();
        }
    }

    updatePolygon() {
        this.polygon.setLatLngs([this.points]);
    }
}

class LatLngWithCircle extends L.LatLng {
    /** @type {L.Circle} */
    circle;

    /**
     * @param {number} latitude
     * @param {number} longitude
     * @param {number} altitude
     */
    constructor(latitude, longitude, altitude) {
        super(latitude, longitude, altitude);
        this.circle = new L.CircleMarker(this, {
            radius: 6,
            fillColor: '#ff0000',
            color: '#000',
            weight: 2,
            opacity: 1,
            fillOpacity: 1
        });
    }

    /**
     * @param {L.LatLng} latlng
     */
    setLatLng(latlng) {
        super.lat = latlng.lat;
        super.lng = latlng.lng;
        this.circle.setLatLng(this);
    }
}

/**
 * @param {L.LatLng} point
 * @param {L.LatLng} line_start
 * @param {L.LatLng} line_end
 * @returns number
 */
function distance(point, line_start, line_end) {
    let x = point.lat;
    let y = point.lng;
    let start_x = line_start.lat;
    let start_y = line_start.lng;
    let dx = line_end.lat - start_x;
    let dy = line_end.lng - start_y;
    if (dx === 0 && dy === 0) {
        return Math.hypot(x - start_x, y - start_y)
    }
    let t = Math.max(0, Math.min(1, ((x - start_x) * dx + (y - start_y) * dy) / (Math.pow(dx, 2) + Math.pow(dy, 2))));
    let closest_x = start_x + t * dx;
    let closest_y = start_y + t * dy;
    return Math.hypot(x - closest_x, y - closest_y);
}

export { Selection };
