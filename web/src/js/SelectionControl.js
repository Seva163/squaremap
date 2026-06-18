import { S } from "./Squaremap.js";
import L from "leaflet";

class SelectionControl {
    /** @type {SubmitButton} */
    submit;
    /** @type {ColorPicker} */
    colorPicker;
    /**
     * @param {string} secret
     */
    constructor(secret) {
        this.submit = new SubmitButton(secret);
        this.colorPicker = new ColorPicker();
        S.map.addControl(this.colorPicker);
        S.map.addControl(this.submit);
        this.colorPicker.getContainer().addEventListener("mousedown", (event) => {
            event.stopPropagation();
        })
        this.colorPicker.input.addEventListener("input", (event) => {
            S.worldList.curWorld.selection.setColor(this.colorPicker.input.value);
        })
    }
}

class SubmitButton extends L.Control {
    /** @type {HTMLDivElement} */
    button;
    /** @type {string} */
    secret;

    constructor(secret) {
        super({ position: "bottomright" });
        this.secret = secret;
    }
    onAdd() {
        const button = L.DomUtil.create("div", "leaflet-control-layers submit");
        button.innerHTML = "Submit selection";
        button.addEventListener("mousedown", (event) => {
            event.stopPropagation();
        })
        button.addEventListener("click", (event) => {
            const selection = S.worldList.curWorld.selection;
            const color = selection.polygon.options.color;
            const points = [];
            for (const point of selection.points) {
                points.push(S.toPoint(point));
            }
            let name = "";
            if (selection.nameInput) {
                name = selection.nameInput._textarea.value;
            } 
            fetch("/api/submitSelection", {
                method: "PUT",
                body: JSON.stringify({
                    secret: this.secret,
                    name: {
                        text: name,
                        pos: S.toPoint(selection.nameInput.getLatLng())
                    },
                    color,
                    points,
                })
            });
            event.stopPropagation();
        });
        this.button = button;
        return button;
    }
}

class ColorPicker extends L.Control {
    /** @type {HTMLInputElement} */
    input;
    /** @type {HTMLLabelElement} */
    label;

    constructor() {
        super({ position: "bottomleft" })
    }
    onAdd() {
        const div = L.DomUtil.create("div", "leaflet-control-layers color-picker");
        div.style.display = "inline-flex";
        const label = L.DomUtil.create("label", "color-picker", div);
        const picker = L.DomUtil.create("input", "color-picker", div);
        label.textContent = "Selection color:"
        label.setAttribute("for", "selection-color-picker");
        picker.id = "selection-color-picker";
        picker.type = "color";
        this.input = picker;
        this.label = label;
        return div;
    }
}

export { SelectionControl };
