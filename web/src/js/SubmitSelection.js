import { S } from "./Squaremap.js";
import L from "leaflet";

class SubmitSelection {
    /** @type {string} */
    secret;
    /** @type {SubmitButton} */
    submit;
    /**
     * @param {string} secret
     */
    constructor(secret) {
        this.secret = secret;
        this.submit = new SubmitButton();
        S.map.addControl(this.submit);
        this.submit.button.innerHTML = "Submit selection";
        this.submit.getContainer().addEventListener("click", (event) => {
            const selection = S.worldList.curWorld.selection;
            const points = [];
            for (const point of selection.points) {
                points.push(S.toPoint(point));
            }
            debugger;
            fetch("/api/submitSelection", {
                method: "PUT",
                body: JSON.stringify({
                    secret,
                    name: {
                        text: selection.nameInput._textarea.value,
                        pos: S.toPoint(selection.nameInput.getLatLng())
                    },
                    points,
                })
            });
            event.stopPropagation();
        });
    }
}

class SubmitButton extends L.Control {
    /** @type {HTMLDivElement} */
    button;

    constructor() {
        super({ position: "bottomleft" });
    }
    onAdd() {
        const button = L.DomUtil.create("div", "leaflet-control-layers submit");
        this.button = button;
        return button;
    }
}

export { SubmitSelection };
