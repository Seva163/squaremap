import L, { LatLng } from "leaflet";
import { S } from "../Squaremap.js";

class Selection {
    /** @type {L.Map} */
    map;
    /** @type {LatLngWithCircle[]} */
    points;
    /** @type {L.Polygon} */
    polygon;
    /** @type {L.Marker} */
    nameInput
    /** @type {boolean} */
    is_dragging;
    /** @type {LatLngWithCircle | L.Marker | undefined} */
    selectedObject;
    /** @type {number} */
    mouseDownTimestamp
    /** @type {L.LatLng} */
    dragStartPosition

    constructor() {
        this.map = S.map;
        this.is_dragging = false;
        this.points = [];
        this.polygon = new L.Polygon([]);
        document.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        })
    }

    load() {
        this.map.on("mousedown", this.onMouseDown, this);
        this.map.on("mouseup", this.onMouseUp, this);
        this.map.on("mousemove", this.onMouseMove, this);
        this.polygon.addTo(this.map);
        this.polygon.addEventListener("contextmenu", (event) => {
            const divicon = L.divIcon({ html: '<textarea class="consistent-scale" type="text" spellcheck="false" id="selection-name">' });
            if (this.nameInput) {
                this.nameInput.remove();
            }
            this.nameInput = L.marker(event.latlng, { icon: divicon });
            this.nameInput.addEventListener("mousedown", () => {
                if (event.originalEvent.button === 1) {
                    this.nameInput.remove();
                    this.nameInput = undefined;
                } else {
                    this.map.dragging.disable();
                    this.is_dragging = true;
                    this.selectedObject = this.nameInput;
                }
            })
            this.nameInput.addTo(this.map);
            /** @type {HTMLTextAreaElement} */
            let textarea = document.getElementById("selection-name");
            const scale = Math.pow(2, this.map.getZoom() - 2);
            textarea.style.transform = `scale(${scale})`
            this.nameInput._textarea = textarea;
            //auto-resize textarea
            textarea.addEventListener('input', () => {
                // TODO: add width resize
                // const font = window.getComputedStyle(textarea).font;
                // const span = document.createElement("span");
                // span.style.position = "absolute";
                // span.style.font = font;
                // span.style.whiteSpace = "pre";
                // span.textContent = textarea.value.split("\n")[0];
                // document.body.appendChild(span);
                // const width = span.offsetWidth;
                // document.body.removeChild(span);
                // textarea.style.width = width + 20;
                textarea.style.height = "auto";
                textarea.style.height = textarea.scrollHeight - 20 * !textarea.value.includes("\n") + 'px';
            });
            // invoke auto-resize
            textarea.dispatchEvent(new Event("input"));
            textarea.focus();
        })
        for (const point of this.points) {
            point.circle.addTo(this.map);
        }
    }

    unload() {
        this.map.removeEventListener("mousedown", this.onMouseDown, this);
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
    onMouseDown(event) {
        this.mouseDownTimestamp = event.originalEvent.timeStamp;
        this.dragStartPosition = event.latlng;
    }

    /**
     * @param {L.LeafletMouseEvent} event
     */
    onMouseUp(event) {
        if (this.is_dragging) {
            this.is_dragging = false;
            this.map.dragging.enable();
            this.selectedObject = undefined;
        } else if (event.originalEvent.timeStamp - this.mouseDownTimestamp < 200 && event.originalEvent.button == 0) {
            this.addPoint(event.latlng);
        }
    }

    /**
     * @param {L.LeafletMouseEvent} event
     */
    onMouseMove(event) {
        if (event.originalEvent.timeStamp - this.mouseDownTimestamp < 200) {
            return;
        }
        if (this.selectedObject instanceof LatLngWithCircle) {
            this.selectedObject.setLatLng(event.latlng);
            this.updatePolygon();
        } else if (this.selectedObject) {
            this.selectedObject.setLatLng(boundByPolygon(event.latlng, this.points));
        }
    }

    /**
     * @param {L.LatLng} latlng
     */
    addPoint(latlng) {
        let i = -1;
        let min_dist = Number.MAX_VALUE;
        // find closest edge
        for (let j = 0; j < this.points.length; j++) {
            let dist = distance(latlng, this.points[j], this.points[(j + 1) % this.points.length]);
            if (dist < min_dist) {
                min_dist = dist;
                i = j;
            }
        }
        let point = new LatLngWithCircle(latlng.lat, latlng.lng);
        this.points.splice(i + 1, 0, point);
        point.circle.addTo(this.map);
        // dragging and removing point
        point.circle.addEventListener("mousedown", (event) => {
            if (event.originalEvent.button === 1) {
                point.circle.removeFrom(this.map);
                this.points.splice(this.points.indexOf(point), 1);
                this.updatePolygon();
            } else {
                this.map.dragging.disable();
                this.is_dragging = true;
                this.selectedObject = point;
            }
        })
        this.updatePolygon();
    }

    updatePolygon() {
        if (this.nameInput) {
            this.nameInput.setLatLng(boundByPolygon(this.nameInput.getLatLng(), this.points));
        }
        this.polygon.setLatLngs([this.points]);
    }
}

class LatLngWithCircle extends L.LatLng {
    /** @type {L.Circle} */
    circle;

    /**
     * @param {number} latitude
     * @param {number} longitude
     */
    constructor(latitude, longitude) {
        super(latitude, longitude);
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
 * @returns {number}
 */
function distance(point, line_start, line_end) {
    const closest_point = findClosestPoint(point, line_start, line_end);
    return Math.hypot(point.lat - closest_point.lat, point.lng - closest_point.lng);
}
/**
 * @param {L.LatLng} point
 * @param {L.LatLng} line_start
 * @param {L.LatLng} line_end
 * @returns {L.LatLng}
 */
function findClosestPoint(point, line_start, line_end) {
    const { lat: x, lng: y } = point;
    const { lat: start_x, lng: start_y } = line_start;
    const dx = line_end.lat - start_x;
    const dy = line_end.lng - start_y;
    if (dx === 0 && dy === 0) {
        return line_end;
    }
    const t = Math.max(0, Math.min(1, ((x - start_x) * dx + (y - start_y) * dy) / (Math.pow(dx, 2) + Math.pow(dy, 2))));
    const closest_x = start_x + t * dx;
    const closest_y = start_y + t * dy;
    return L.latLng(closest_x, closest_y);
}
/**
 * @param {L.LatLng} point
 * @param {L.LatLng[]} polygon
 * @returns {L.LatLng}
 */
function boundByPolygon(point, polygon) {
    if (isInPolygon(point, polygon)) {
        return point;
    } else {
        let n = 0;
        let min_dist = Number.MAX_VALUE;
        for (let i = 0; i < polygon.length; i++) {
            const dist = distance(point, polygon[i], polygon[(i + 1) % polygon.length]);
            if (dist < min_dist) {
                min_dist = dist;
                n = i;
            }
        }
        const closest_point = findClosestPoint(point, polygon[n], polygon[(n + 1) % polygon.length]);
        return L.latLng(closest_point.lat, closest_point.lng);
    }
}

/**
 * @param {L.LatLng} point
 * @param {L.LatLng[]} polygon
 * @returns {boolean}
 */
function isInPolygon(point, polygon) {
    const { lat: x, lng: y } = point;
    let inside = false;
    for (let i = 0; i < polygon.length; i++) {
        const { lat: x1, lng: y1 } = polygon[i];
        const { lat: x2, lng: y2 } = polygon[(i + 1) % polygon.length];
        const intersect = ((y1 > y) !== (y2 > y)) &&
            (x < (x2 - x1) * (y - y1) / (y2 - y1) + x1);
        if (intersect) {
            inside = !inside;
        }
    }
    return inside;
}

export { Selection };
