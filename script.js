const TOTAL_SLOTS = 12;
const ADMIN_PIN = "1234"; // change this to your own PIN

let bookings = JSON.parse(localStorage.getItem("smartParkBookings")) || [];
let occupied = JSON.parse(localStorage.getItem("smartParkOccupied")) || [];
let parkingHistory = JSON.parse(localStorage.getItem("smartParkHistory")) || [];

const slotGrid = document.getElementById("slotGrid");
const slotSelect = document.getElementById("slotSelect");
const bookingList = document.getElementById("bookingList");
const adminGrid = document.getElementById("adminGrid");
const bookingForm = document.getElementById("bookingForm");
const message = document.getElementById("message");
const locationFilter = document.getElementById("locationFilter");
const vehicleTypeSelect = document.getElementById("vehicleType");
const recommendSlotBtn = document.getElementById("recommendSlotBtn");
const recommendMessage = document.getElementById("recommendMessage");
const priorityBox = document.getElementById("priorityAccess");

const PARKING_LOCATIONS = {
    "City Centre": ["P1", "P2", "P3", "P4"],
    "Bus Stand": ["P5", "P6", "P7", "P8"],
    "Railway Station": ["P9", "P10", "P11", "P12"]
};

// Every location has at least one Car, Bike and EV slot
const SLOT_TYPES = {
    P1: "Car", P2: "Bike", P3: "EV", P4: "Priority",
    P5: "Car", P6: "Bike", P7: "EV", P8: "Priority",
    P9: "Car", P10: "Bike", P11: "EV", P12: "Priority"
};

const TYPE_ICONS = { Car: "🚗", Bike: "🏍️", EV: "⚡", Priority: "♿" };

function getSlotLocation(slot) {
    return Object.keys(PARKING_LOCATIONS).find(location => PARKING_LOCATIONS[location].includes(slot)) || "Unknown";
}

function saveData() {
    localStorage.setItem("smartParkBookings", JSON.stringify(bookings));
    localStorage.setItem("smartParkOccupied", JSON.stringify(occupied));
    localStorage.setItem("smartParkHistory", JSON.stringify(parkingHistory));
}

function logRecord(booking, status) {
    parkingHistory.push({ ...booking, status, endedAt: new Date().toLocaleString() });
    saveData();
}

/* ---------- Parking timer & fare ---------- */

const RATES = { "Car": 20, "Bike": 10, "Electric Vehicle (EV)": 30 }; // Rs per hour

function calcFare(startedAt, vehicleType) {
    const mins = Math.max(1, Math.ceil((Date.now() - startedAt) / 60000));
    const hours = Math.max(1, Math.ceil(mins / 60));
    return { mins, fare: hours * (RATES[vehicleType] || 20) };
}

function startParking(id) {
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    b.startedAt = Date.now();
    if (!occupied.includes(b.slot)) occupied.push(b.slot);
    saveData();
    renderAll();
}

function endParking(id) {
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    const r = calcFare(b.startedAt, b.vehicleType);
    if (!confirm("End parking? Fare: Rs " + r.fare + " (" + r.mins + " min)")) return;

    logRecord(b, "Completed - Rs " + r.fare + " (" + r.mins + " min)");
    bookings = bookings.filter(x => x.id !== id);
    occupied = occupied.filter(sl => sl !== b.slot);
    saveData();
    renderAll();
    message.textContent = "Parking ended. Duration: " + r.mins + " min. Total fare: Rs " + r.fare;
}

function updateTimers() {
    document.querySelectorAll(".live-timer").forEach(el => {
        const start = Number(el.dataset.start);
        const secs = Math.floor((Date.now() - start) / 1000);
        const mm = String(Math.floor(secs / 60)).padStart(2, "0");
        const ss = String(secs % 60).padStart(2, "0");
        const r = calcFare(start, el.dataset.type);
        el.textContent = "Timer " + mm + ":" + ss + " | Fare so far: Rs " + r.fare;
    });
}

function getStatus(slot) {
    if (occupied.includes(slot)) return "Occupied";
    if (bookings.some(b => b.slot === slot)) return "Booked";
    return "Available";
}

/* ---------- Smart slot rules ---------- */

// Slot types a vehicle may use, best choice first
function allowedSlotTypes(vehicleType, priority) {
    let types = [];
    if (vehicleType === "Car") types = ["Car"];
    else if (vehicleType === "Bike") types = ["Bike"];
    else if (vehicleType === "Electric Vehicle (EV)") types = ["EV", "Car"];

    if (priority && types.length) types.unshift("Priority");
    return types;
}

function isSlotAllowed(slot, vehicleType, priority) {
    if (!vehicleType) return true;
    return allowedSlotTypes(vehicleType, priority).includes(SLOT_TYPES[slot]);
}

function findBestSlot(location, vehicleType, priority) {
    const order = allowedSlotTypes(vehicleType, priority);
    const free = (PARKING_LOCATIONS[location] || [])
        .filter(s => getStatus(s) === "Available" && order.includes(SLOT_TYPES[s]));

    free.sort((a, b) => order.indexOf(SLOT_TYPES[a]) - order.indexOf(SLOT_TYPES[b]));
    return free[0] || null;
}

/* ---------- Dashboard ---------- */

function updateDashboard() {
    let available = 0;
    let booked = 0;
    let unavailable = 0;

    for (let i = 1; i <= TOTAL_SLOTS; i++) {
        const status = getStatus("P" + i);

        if (status === "Available") available++;
        else if (status === "Booked") booked++;
        else unavailable++;
    }

    document.getElementById("totalSlots").textContent = TOTAL_SLOTS;
    document.getElementById("availableSlots").textContent = available;
    document.getElementById("occupiedSlots").textContent = unavailable;
    document.getElementById("bookedSlots").textContent = booked;
}

function renderSlots() {
    const previous = slotSelect.value;

    slotGrid.innerHTML = "";
    slotSelect.innerHTML = '<option value="">Choose a slot</option>';

    const selectedLocation = locationFilter.value;
    const locationSlots = PARKING_LOCATIONS[selectedLocation] || [];

    locationSlots.forEach(slot => {
        const status = getStatus(slot);
        const type = SLOT_TYPES[slot];

        const card = document.createElement("div");
        card.className = "slot";

        if (status === "Available") {
            card.classList.add("available-slot");
        } else if (status === "Booked") {
            card.classList.add("booked-slot");
        } else {
            card.classList.add("occupied-slot");
        }

        card.innerHTML = `
            <h3>🅿 ${slot}</h3>
            <p class="slot-type">${TYPE_ICONS[type]} ${type}</p>
            <p>${status}</p>
        `;

        if (status === "Available") {
            card.addEventListener("click", () => {
                if (isSlotAllowed(slot, vehicleTypeSelect.value, priorityBox.checked)) {
                    slotSelect.value = slot;
                    recommendMessage.textContent = "";
                } else {
                    recommendMessage.textContent = slot + " is a " + type +
                        " slot and doesn't match your vehicle type or priority status.";
                }
                document.getElementById("booking").scrollIntoView({
                    behavior: "smooth"
                });
            });

            if (isSlotAllowed(slot, vehicleTypeSelect.value, priorityBox.checked)) {
                const option = document.createElement("option");
                option.value = slot;
                option.textContent = slot + " (" + type + ")";
                slotSelect.appendChild(option);
            }
        }

        slotGrid.appendChild(card);
    });

    slotSelect.value = previous;
}

/* ---------- My Bookings (user) ---------- */

function renderBookings() {
    bookingList.innerHTML = "";

    if (bookings.length === 0) {
        bookingList.textContent = "No bookings yet. Book your first parking slot!";
        return;
    }

    bookings.forEach(booking => {
        const card = document.createElement("div");
        card.className = "booking-card";

        const details = [
            ["Booking ID", booking.id],
            ["Name", booking.name],
            ["Vehicle Number", booking.vehicle],
            ["Vehicle Type", booking.vehicleType || "Not specified"],
            ["Phone", booking.phone],
            ["Parking Location", booking.location || getSlotLocation(booking.slot)],
            ["Parking Slot", booking.slot],
            ["Slot Type", SLOT_TYPES[booking.slot] || "Standard"],
            ["Date", booking.date],
            ["Time", booking.time]
        ];

        details.forEach(([label, value]) => {
            const p = document.createElement("p");
            p.textContent = label + ": " + value;
            card.appendChild(p);
        });

        const cancel = document.createElement("button");
        cancel.className = "cancel-btn";
        cancel.textContent = "Cancel Booking";

        cancel.addEventListener("click", () => {
            if (confirm("Are you sure you want to cancel this booking?")) {
                logRecord(booking, "Cancelled by user");
                bookings = bookings.filter(b => b.id !== booking.id);
                saveData();
                renderAll();
                message.textContent = "Booking cancelled successfully.";
            }
        });

        if (booking.startedAt) {
            const timer = document.createElement("p");
            timer.className = "live-timer";
            timer.dataset.start = booking.startedAt;
            timer.dataset.type = booking.vehicleType;
            card.appendChild(timer);

            const end = document.createElement("button");
            end.className = "main-btn";
            end.textContent = "End Parking & Pay";
            end.addEventListener("click", () => endParking(booking.id));
            card.appendChild(end);
        } else {
            const start = document.createElement("button");
            start.className = "main-btn";
            start.style.marginRight = "10px";
            start.textContent = "Start Parking";
            start.addEventListener("click", () => startParking(booking.id));
            card.appendChild(start);
            card.appendChild(cancel);
        }

        bookingList.appendChild(card);
    });
}

/* ---------- Admin dashboard ---------- */

function isAdmin() {
    return sessionStorage.getItem("smartParkAdmin") === "yes";
}

function addRow(tbody, values) {
    const tr = document.createElement("tr");
    values.forEach(v => {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
    });
    tbody.appendChild(tr);
    return tr;
}

function renderAdmin() {
    const on = isAdmin();
    document.getElementById("adminLogin").hidden = on;
    document.getElementById("adminPanel").hidden = !on;
    if (!on) return;

    renderAdminLocations();
    renderAdminSlots();
    renderAdminBookings();
    renderAdminHistory();
}

function renderAdminLocations() {
    const box = document.getElementById("adminLocations");
    box.innerHTML = "";

    Object.entries(PARKING_LOCATIONS).forEach(([loc, slots]) => {
        const count = { Available: 0, Booked: 0, Occupied: 0 };
        slots.forEach(s => count[getStatus(s)]++);

        const item = document.createElement("div");
        item.className = "admin-item";
        const info = document.createElement("span");
        info.textContent = loc + ": " + (count.Booked + count.Occupied) + "/" +
            slots.length + " used (" + count.Available + " free)";
        item.appendChild(info);
        box.appendChild(item);
    });
}

function renderAdminSlots() {
    adminGrid.innerHTML = "";

    for (let i = 1; i <= TOTAL_SLOTS; i++) {
        const slot = "P" + i;
        const status = getStatus(slot);

        const item = document.createElement("div");
        item.className = "admin-item";

        const info = document.createElement("span");
        info.textContent = slot + " [" + SLOT_TYPES[slot] + "] (" + getSlotLocation(slot) + ") - " + status;
        item.appendChild(info);

        const button = document.createElement("button");
        button.className = "admin-btn";

        if (status === "Available") {
            button.textContent = "Mark Occupied";
            button.onclick = () => { occupied.push(slot); saveData(); renderAll(); };
        } else if (status === "Occupied") {
            button.textContent = "Mark Available";
            button.onclick = () => {
                occupied = occupied.filter(s => s !== slot);
                saveData();
                renderAll();
            };
        } else {
            button.textContent = "Booked";
            button.disabled = true;
        }

        item.appendChild(button);
        adminGrid.appendChild(item);
    }
}

function renderAdminBookings() {
    const tbody = document.getElementById("adminBookings");
    tbody.innerHTML = "";

    if (bookings.length === 0) {
        addRow(tbody, ["No active bookings", "", "", "", "", "", ""]);
        return;
    }

    bookings.forEach(b => {
        const tr = addRow(tbody, [b.id, b.name, b.vehicle, b.slot, b.date, b.time]);
        const td = document.createElement("td");

        const done = document.createElement("button");
        done.className = "admin-btn";
        done.textContent = "Complete";
        done.onclick = () => {
            logRecord(b, "Completed");
            bookings = bookings.filter(x => x.id !== b.id);
            occupied = occupied.filter(s => s !== b.slot);
            saveData();
            renderAll();
        };

        const cancel = document.createElement("button");
        cancel.className = "cancel-btn";
        cancel.textContent = "Cancel";
        cancel.onclick = () => {
            if (!confirm("Cancel booking " + b.id + "?")) return;
            logRecord(b, "Cancelled by admin");
            bookings = bookings.filter(x => x.id !== b.id);
            occupied = occupied.filter(s => s !== b.slot);
            saveData();
            renderAll();
        };

        td.appendChild(done);
        td.appendChild(cancel);
        tr.appendChild(td);
    });
}

function renderAdminHistory() {
    const tbody = document.getElementById("adminHistory");
    tbody.innerHTML = "";

    if (parkingHistory.length === 0) {
        addRow(tbody, ["No records yet", "", "", "", "", ""]);
        return;
    }

    parkingHistory.slice().reverse().slice(0, 20).forEach(r => {
        addRow(tbody, [r.id, r.name, r.vehicle, r.slot, r.status, r.endedAt]);
    });
}

function renderAll() {
    updateDashboard();
    renderSlots();
    renderBookings();
    renderAdmin();
}

/* ---------- Booking form ---------- */

bookingForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const vehicle = document.getElementById("vehicle").value.trim();
    const vehicleType = vehicleTypeSelect.value;
    const phone = document.getElementById("phone").value.trim();
    const slot = slotSelect.value;
    const location = locationFilter.value;
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;

    if (!name || !vehicle || !vehicleType || !phone || !slot || !date || !time) {
        message.textContent = "Please fill in all the details.";
        return;
    }

    if (!/^[0-9]{10}$/.test(phone)) {
        message.textContent = "Enter a valid 10-digit phone number.";
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDate = new Date(date + "T00:00:00");

    if (selectedDate < today) {
        message.textContent = "Please select today or a future date.";
        return;
    }

    if (!PARKING_LOCATIONS[location] || !PARKING_LOCATIONS[location].includes(slot)) {
        message.textContent = "Please select a slot from the chosen parking location.";
        return;
    }

    if (!isSlotAllowed(slot, vehicleType, priorityBox.checked)) {
        message.textContent = "This slot type doesn't match your vehicle type or priority status.";
        return;
    }

    if (getStatus(slot) !== "Available") {
        message.textContent = "Sorry, this parking slot is not available.";
        renderAll();
        return;
    }

    const booking = {
        id: "SP" + Date.now(),
        name,
        vehicle: vehicle.toUpperCase(),
        vehicleType,
        phone,
        location,
        slot,
        slotType: SLOT_TYPES[slot],
        priority: priorityBox.checked,
        date,
        time
    };

    bookings.push(booking);
    saveData();
    renderAll();

    message.textContent =
        "Booking successful! Your Booking ID is " + booking.id;

    bookingForm.reset();
    recommendMessage.textContent = "";
    renderSlots();
});

document.getElementById("date").min =
    new Date().toLocaleDateString("en-CA");

/* ---------- Auto-allocate ---------- */

function recommendAvailableSlot() {
    const vehicleType = vehicleTypeSelect.value;
    const priority = priorityBox.checked;

    if (!vehicleType) {
        recommendMessage.textContent = "Please choose your vehicle type first.";
        return;
    }

    let location = locationFilter.value;
    let slot = findBestSlot(location, vehicleType, priority);

    if (!slot) {
        const other = Object.keys(PARKING_LOCATIONS)
            .find(loc => findBestSlot(loc, vehicleType, priority));

        if (!other) {
            recommendMessage.textContent = "No suitable slot is free at any location right now.";
            slotSelect.value = "";
            return;
        }

        location = other;
        locationFilter.value = other;
        renderSlots();
        slot = findBestSlot(other, vehicleType, priority);
    }

    slotSelect.value = slot;
    recommendMessage.textContent = "Allocated slot " + slot + " (" +
        SLOT_TYPES[slot] + ") at " + location + ". You can change it if you prefer.";
}

recommendSlotBtn.addEventListener("click", recommendAvailableSlot);

[locationFilter, vehicleTypeSelect, priorityBox].forEach(el => {
    el.addEventListener("change", () => {
        recommendMessage.textContent = "";
        renderSlots();
    });
});

/* ---------- Admin login ---------- */

function adminLogin() {
    const pin = document.getElementById("adminPin").value;
    const msg = document.getElementById("adminLoginMsg");

    if (pin === ADMIN_PIN) {
        sessionStorage.setItem("smartParkAdmin", "yes");
        document.getElementById("adminPin").value = "";
        msg.textContent = "";
        renderAll();
    } else {
        msg.textContent = "Incorrect PIN.";
    }
}

document.getElementById("adminLoginBtn").addEventListener("click", adminLogin);
document.getElementById("adminPin").addEventListener("keydown", e => {
    if (e.key === "Enter") adminLogin();
});
document.getElementById("adminLogoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("smartParkAdmin");
    renderAll();
});

renderAll();
/* ---------- STEP 5: AI Parking Agent (rule-based, live data) ---------- */

const chatLog = document.getElementById("chatLog");
const chatInput = document.getElementById("chatInput");
let agentVehicle = "";   // remembers the vehicle type mentioned earlier
let agentPriority = false;

function detectVehicle(t) {
    if (/\b(ev|electric)\b/.test(t)) return "Electric Vehicle (EV)";
    if (/\b(bike|bikes|motorcycle|scooter|two.?wheeler)\b/.test(t)) return "Bike";
    if (/\b(car|cars|suv|sedan)\b/.test(t)) return "Car";
    return "";
}

function detectLocation(t) {
    if (/city|centre|center/.test(t)) return "City Centre";
    if (/bus/.test(t)) return "Bus Stand";
    if (/rail|station|train/.test(t)) return "Railway Station";
    return "";
}

function freeCounts(location) {
    const c = { Car: 0, Bike: 0, EV: 0, Priority: 0 };
    PARKING_LOCATIONS[location].forEach(s => {
        if (getStatus(s) === "Available") c[SLOT_TYPES[s]]++;
    });
    return c;
}

function availabilityText(location, vehicle) {
    const places = location ? [location] : Object.keys(PARKING_LOCATIONS);
    const lines = places.map(loc => {
        const c = freeCounts(loc);
        return loc + ": " + c.Car + " Car, " + c.Bike + " Bike, " + c.EV + " EV, " + c.Priority + " Priority free";
    });
    let total = 0;
    for (let i = 1; i <= TOTAL_SLOTS; i++) if (getStatus("P" + i) === "Available") total++;
    return "Live availability (" + total + " of " + TOTAL_SLOTS + " slots free overall):\n" + lines.join("\n");
}

function bestAcrossLocations(preferred, vehicle, priority) {
    const order = preferred ? [preferred, ...Object.keys(PARKING_LOCATIONS).filter(l => l !== preferred)]
                            : Object.keys(PARKING_LOCATIONS);
    for (const loc of order) {
        const slot = findBestSlot(loc, vehicle, priority);
        if (slot) return { slot, loc };
    }
    return null;
}

function agentReply(text) {
    const t = text.toLowerCase();
    const vehicle = detectVehicle(t);
    const location = detectLocation(t);
    if (vehicle) agentVehicle = vehicle;
    if (/senior|disab|handicap|wheelchair|priority/.test(t)) agentPriority = true;

    if (/\b(hi|hello|hey|help)\b/.test(t) && !/book|park|fare/.test(t)) {
        return "Hi! I can check live availability, recommend a slot, quote fares, or prepare a booking for you. Try: \"Where can I park my EV?\"";
    }

    if (/fare|price|cost|rate|charge|how much|pay/.test(t)) {
        return "Parking rates (billed per hour, rounded up, 1 hour minimum):\n" +
            "Car: Rs " + RATES["Car"] + "/hour\nBike: Rs " + RATES["Bike"] + "/hour\nEV: Rs " + RATES["Electric Vehicle (EV)"] +
            "/hour\nThe timer starts when you press Start Parking in My Bookings.";
    }

    if (/cancel|refund/.test(t)) {
        return "You can cancel any booking from My Bookings, as long as you haven't started parking. Once the timer has started, use End Parking & Pay instead.";
    }

    if (/book|reserve|allocate|get me|i want|need a slot/.test(t)) {
        if (!agentVehicle) {
            return "Sure! What type of vehicle do you have: Car, Bike or EV?";
        }
        const pick = bestAcrossLocations(location, agentVehicle, agentPriority);
        if (!pick) {
            return "Sorry, no suitable slot is free for a " + agentVehicle + " right now. Please check again shortly.";
        }
        vehicleTypeSelect.value = agentVehicle;
        priorityBox.checked = agentPriority;
        locationFilter.value = pick.loc;
        renderSlots();
        slotSelect.value = pick.slot;
        document.getElementById("booking").scrollIntoView({ behavior: "smooth" });
        return "I've picked slot " + pick.slot + " (" + SLOT_TYPES[pick.slot] + ") at " + pick.loc +
            " for your " + agentVehicle + ".\nI've filled in the booking form. Just add your name, vehicle number, phone, date and time, then press Confirm Booking.";
    }

    if (/park|where|slot|space|available|availability|free|empty|spot/.test(t)) {
        let reply = availabilityText(location, vehicle);
        if (agentVehicle) {
            const pick = bestAcrossLocations(location, agentVehicle, agentPriority);
            reply += pick
                ? "\n\nBest option for your " + agentVehicle + ": slot " + pick.slot + " (" + SLOT_TYPES[pick.slot] + ") at " + pick.loc + ". Say \"book it\" and I'll prepare the booking."
                : "\n\nNo suitable slot is free for a " + agentVehicle + " right now.";
        } else {
            reply += "\n\nTell me your vehicle type (Car, Bike or EV) and I'll recommend the best slot.";
        }
        return reply;
    }

    if (/book it|yes|ok|okay|sure/.test(t) && agentVehicle) {
        return agentReply("book " + agentVehicle);
    }

    return "I can help with availability, slot recommendations, fares and booking. Try: \"Where can I park my car?\" or \"Book a bike slot\".";
}

function addChat(who, text) {
    const div = document.createElement("div");
    div.className = "msg " + who;
    div.textContent = text;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function sendChat(text) {
    const q = (text || "").trim();
    if (!q) return;
    addChat("user", q);
    chatInput.value = "";
    addChat("bot", agentReply(q));
}

document.getElementById("chatSend").addEventListener("click", () => sendChat(chatInput.value));
chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendChat(chatInput.value); });
document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => sendChat(chip.textContent));
});

addChat("bot", "Hi! I'm the SmartPark assistant. Ask me about free slots, fares, or say \"book a car slot\".");

setInterval(updateTimers, 1000);
