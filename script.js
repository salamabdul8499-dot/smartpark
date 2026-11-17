
const TOTAL_SLOTS = 12;

let bookings = JSON.parse(localStorage.getItem("smartParkBookings")) || [];
let occupied = JSON.parse(localStorage.getItem("smartParkOccupied")) || [];

const slotGrid = document.getElementById("slotGrid");
const slotSelect = document.getElementById("slotSelect");
const bookingList = document.getElementById("bookingList");
const adminGrid = document.getElementById("adminGrid");
const bookingForm = document.getElementById("bookingForm");
const message = document.getElementById("message");

function saveData() {
    localStorage.setItem("smartParkBookings", JSON.stringify(bookings));
    localStorage.setItem("smartParkOccupied", JSON.stringify(occupied));
}

function getStatus(slot) {
    if (occupied.includes(slot)) return "Occupied";
    if (bookings.some(b => b.slot === slot)) return "Booked";
    return "Available";
}

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
    slotGrid.innerHTML = "";
    slotSelect.innerHTML = '<option value="">Choose a slot</option>';

    for (let i = 1; i <= TOTAL_SLOTS; i++) {
        const slot = "P" + i;
        const status = getStatus(slot);

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
            <p>${status}</p>
        `;

        if (status === "Available") {
            card.addEventListener("click", () => {
                slotSelect.value = slot;
                document.getElementById("booking").scrollIntoView({
                    behavior: "smooth"
                });
            });

            const option = document.createElement("option");
            option.value = slot;
            option.textContent = slot;
            slotSelect.appendChild(option);
        }

        slotGrid.appendChild(card);
    }
}

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
            ["Vehicle", booking.vehicle],
            ["Phone", booking.phone],
            ["Parking Slot", booking.slot],
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
                bookings = bookings.filter(b => b.id !== booking.id);
                saveData();
                renderAll();
                message.textContent = "Booking cancelled successfully.";
            }
        });

        card.appendChild(cancel);
        bookingList.appendChild(card);
    });
}

function renderAdmin() {
    adminGrid.innerHTML = "";

    for (let i = 1; i <= TOTAL_SLOTS; i++) {
        const slot = "P" + i;
        const status = getStatus(slot);

        const item = document.createElement("div");
        item.className = "admin-item";

        const info = document.createElement("span");
        info.textContent = slot + " - " + status;
        item.appendChild(info);

        const button = document.createElement("button");
        button.className = "admin-btn";

        if (status === "Available") {
            button.textContent = "Mark Occupied";

            button.onclick = () => {
                occupied.push(slot);
                saveData();
                renderAll();
            };
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

function renderAll() {
    updateDashboard();
    renderSlots();
    renderBookings();
    renderAdmin();
}

bookingForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const vehicle = document.getElementById("vehicle").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const slot = slotSelect.value;
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;

    if (!name || !vehicle || !phone || !slot || !date || !time) {
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

    if (getStatus(slot) !== "Available") {
        message.textContent = "Sorry, this parking slot is not available.";
        renderAll();
        return;
    }

    const booking = {
        id: "SP" + Date.now(),
        name,
        vehicle: vehicle.toUpperCase(),
        phone,
        slot,
        date,
        time
    };

    bookings.push(booking);
    saveData();
    renderAll();

    message.textContent =
        "Booking successful! Your Booking ID is " + booking.id;

    bookingForm.reset();
});

document.getElementById("date").min =
    new Date().toLocaleDateString("en-CA");

renderAll();
