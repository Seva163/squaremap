import L from "leaflet";
import { S } from "../Squaremap.js";

//span for text width mesurment
const span = document.createElement("span");
span.style.position = "absolute";
span.style.whiteSpace = "pre";
document.body.appendChild(span);

class Selection {
    /** @type {L.Map} */
    map;
    /** @type {LatLngWithCircle[]} */
    points;
    /** @type {L.Polygon} */
    polygon;
    /** @type {NameInput} */
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
        this.polygon.addEventListener("contextmenu", (event) => {
            if (this.nameInput) {
                this.nameInput.remove();
            }
            this.nameInput = new NameInput(event.latlng, this.map);
            this.nameInput.addEventListener("mousedown", (event) => {
                if (event.originalEvent.button !== 1) {
                    this.map.dragging.disable();
                    this.is_dragging = true;
                    this.selectedObject = this.nameInput;
                }
            })
            this.nameInput.addEventListener("mouseup", (event) => {
                if (event.originalEvent.button == 1 && event.originalEvent.timeStamp - this.mouseDownTimestamp < 300) {
                    // Firefox crashes if removed immediately
                    const forRemoval = this.nameInput;
                    this.nameInput = undefined;
                    setTimeout(() => {
                        forRemoval.remove();
                    })
                }
            })
            this.nameInput.addTo(this.map);
        })
        document.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        })
    }

    load() {
        this.map.on("mousedown", this.onMouseDown, this);
        this.map.on("mouseup", this.onMouseUp, this);
        this.map.on("mousemove", this.onMouseMove, this);
        if (this.nameInput) {
            this.nameInput.addTo(this.map);
        }
        S.selectionControl.colorPicker.input.value = this.polygon.options.color;
        this.polygon.addTo(this.map);
        for (const point of this.points) {
            point.circle.addTo(this.map);
        }
    }

    unload() {
        this.map.removeEventListener("mousedown", this.onMouseDown, this);
        this.map.removeEventListener("mouseup", this.onMouseUp, this);
        this.map.removeEventListener("mousemove", this.onMouseMove, this);
        if (this.nameInput) {
            this.nameInput.removeFrom(this.map);
        }
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
        // dragging point
        point.circle.addEventListener("mousedown", (event) => {
            if (event.originalEvent.button !== 1) {
                this.map.dragging.disable();
                this.is_dragging = true;
                this.selectedObject = point;
            }
        })
        point.circle.addEventListener("mouseup", (event) => {
            if (event.originalEvent.button === 1 && event.originalEvent.timeStamp - this.mouseDownTimestamp < 300) {
                point.circle.removeFrom(this.map);
                this.points.splice(this.points.indexOf(point), 1);
                this.updatePolygon();
            }
        })
        this.updatePolygon();
    }

    /**
     * @param {string} color
     */
    setColor(color) {
        this.polygon.setStyle({ color });
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

class NameInput extends L.Marker {
    /** @type {HTMLTextAreaElement} */
    textarea;
    /** @type {boolean} */
    firstAddEvent;

    /**
     * @param {L.LatLng} latlng
     * @param {L.Map} map
     */
    constructor(latlng, map) {
        super(latlng);
        const div = L.DomUtil.create("div");
        const textarea = L.DomUtil.create("textarea", "consistent-scale", div);
        textarea.setAttribute("type", "text");
        textarea.setAttribute("spellcheck", "false");
        textarea.setAttribute("id", "selection-name");
        super.setIcon(L.divIcon({ html: textarea }));
        this.firstAddEvent = true;
        this.addEventListener("add", () => {
            const scale = Math.pow(2, map.getZoom() - 2);
            textarea.style.transform = `scale(${scale})`
            //auto-resize textarea
            textarea.addEventListener('input', () => {
                span.style.font = window.getComputedStyle(textarea).font;
                let width = 0;
                for (const line of textarea.value.split("\n")) {
                    span.textContent = line;
                    width = Math.max(width, Math.min(200, span.offsetWidth + 1))
                }
                textarea.style.width = width + "px";
                textarea.style.height = "auto";
                textarea.style.height = textarea.scrollHeight + "px";
            });
            // invoke auto-resize
            textarea.dispatchEvent(new Event("input"));
            if (this.firstAddEvent) {
                this.firstAddEvent = false;
                textarea.focus();
            }
        })
        textarea.addEventListener("focusout", () => {
            if (textarea.value.trim().length == 0) {
                this.remove();
            }
        })
        this.textarea = textarea;
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
