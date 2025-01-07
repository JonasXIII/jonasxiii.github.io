const MAX_COMBINE_SLOTS = 8; // Maximum number of adjacent slots to combine

const schedule = document.getElementById("schedule");
const friendToggles = document.getElementById("friend-toggles");

const friends = [
    { name: "Dylan", color: "blue", schedule: [
        { day: 0, start: 13, end: 14, text: "Cloud Computing"},
        { day: 1, start: 9.5, end: 10, text: "Astro"},
        { day: 1, start: 13, end: 14, text: "Cloud Computing"},
        { day: 1, start: 14, end: 16, text: "247 Lab"},
        { day: 1, start: 16, end: 17, text: "Grad Seminar"},
        { day: 1, start: 17, end: 17.5, text: "Tutorial"},
        { day: 1, start: 17.5, end: 18, text: "Status"},
        { day: 2, start: 13, end: 14, text: "Cloud Computing"},
        { day: 3, start: 16.5, end: 17.5, text: "Reading Group"},
        { day: 3, start: 10, end: 10.5, text: "Grading Meeting"},
        { day: 4, start: 13, end: 14, text: "Cloud Computing"}
    ] },
    { name: "Jonas", color: "green", schedule: [
        { day: 0, start: 13, end: 14, text: "Cloud Computing"},
        { day: 0, start: 17, end: 17.5, text: "Arch"},
        { day: 1, start: 13, end: 14, text: "Cloud Computing"},
        { day: 1, start: 14, end: 16, text: "Deep Learning"},
        { day: 1, start: 16, end: 17, text: "Grad Seminar"},
        { day: 1, start: 17, end: 17.5, text: "Tutorial"},
        { day: 1, start: 17.5, end: 18, text: "Status"},
        { day: 2, start: 13, end: 14, text: "Cloud Computing"},
        { day: 3, start: 14, end: 18, text: "Deep Learning"},
        { day: 3, start: 16.5, end: 17.5, text: "Reading Group"},
        { day: 4, start: 13, end: 14, text: "Cloud Computing"}
    ] },
    { name: "Nic", color: "red", schedule: [
        { day: 0, start: 11, end: 11.5, text: "Bio"},
        { day: 1, start: 14, end: 16, text: "Deep Learning"},
        { day: 1, start: 16, end: 17, text: "Grad Seminar"},
        { day: 1, start: 17, end: 17.5, text: "Tutorial"},
        { day: 1, start: 17.5, end: 18, text: "Status"},
        { day: 2, start: 10, end: 14, text: "241 Lab"},
        { day: 3, start: 14, end: 18, text: "Deep Learning"},
        { day: 3, start: 16.5, end: 17.5, text: "Reading Group"},
    ] },
    { name: "Katelynn", color: "purple", schedule: [
        { day: 0, start: 11, end: 12, text: "Databases"},
        { day: 0, start: 12, end: 13, text: "OOD"},
        { day: 0, start: 16, end: 16.5, text: "Climate"},
        { day: 1, start: 11, end: 12, text: "Databases"},
        { day: 1, start: 12, end: 13, text: "OOD"},
        { day: 1, start: 14, end: 16, text: "Deep Learning"},
        { day: 1, start: 17, end: 17.5, text: "Tutorial"},
        { day: 1, start: 17.5, end: 18, text: "Status"},
        { day: 2, start: 9.5, end: 10, text: "Colab Climate"},
        { day: 2, start: 11, end: 12, text: "Databases"},
        { day: 2, start: 12, end: 13, text: "OOD"},
        { day: 3, start: 14, end: 18, text: "Deep Learning"},
        { day: 3, start: 16.5, end: 17.5, text: "Reading Group"},
        { day: 4, start: 11, end: 12, text: "Databases"},
        { day: 4, start: 12, end: 13, text: "OOD"},
    ] },
];

function renderSchedule() {
    schedule.innerHTML = "";

    // Add day headers (row 1, columns 2-6)
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    dayNames.forEach((day, index) => {
        const dayHeader = document.createElement("div");
        dayHeader.className = "schedule-header";
        dayHeader.style.gridColumn = `${index + 2}`; // Columns start at 2 for days
        dayHeader.textContent = day;
        schedule.appendChild(dayHeader);
    });

    // Add time column (column 1, rows 2-57)
    for (let i = 8; i <= 21.75; i += 0.25) {
        const timeSlot = document.createElement("div");
        timeSlot.className = "time-slot";
        const hour = Math.floor(i);
        const minutes = (i % 1) * 60;
        timeSlot.textContent = `${hour}:${minutes === 0 ? "00" : minutes}`;
        timeSlot.style.gridRow = `${(i - 8) * 4 + 2}`; // Start at row 2
        schedule.appendChild(timeSlot);
    }

    // Add schedule slots (columns 2-6, rows 2-57)
    for (let day = 0; day < 5; day++) {
        for (let time = 8; time <= 21.75; time += 0.25) {
            const slot = document.createElement("div");
            slot.className = "schedule-slot";
            slot.dataset.day = day;
            slot.dataset.hour = time;
            slot.style.gridColumn = `${day + 2}`; // Columns start at 2
            slot.style.gridRow = `${(time - 8) * 4 + 2}`; // Rows start at 2
            schedule.appendChild(slot);
        }
    }
}

function updateSchedule() {
    renderSchedule();
    const activeFriends = friends.filter(friend =>
        document.getElementById(`toggle-${friend.name}`).checked
    );

    const eventsBySlot = {};

    // Collect all events in each timeslot
    activeFriends.forEach(friend => {
        friend.schedule.forEach(event => {
            for (let time = event.start; time < event.end; time += 0.25) {
                const key = `${event.day}-${time}`;
                if (!eventsBySlot[key]) eventsBySlot[key] = [];
                eventsBySlot[key].push({ ...event, color: friend.color });
            }
        });
    });

    // Group and display events
    Object.entries(eventsBySlot).forEach(([key, events]) => {
        const [day, hour] = key.split("-");
        const slot = document.querySelector(
            `.schedule-slot[data-day="${day}"][data-hour="${hour}"]`
        );

        if (slot) {
            // Handle merging of adjacent slots
            let mergedHeight = 1;
            let mergedEvents = events;
            for (let offset = 1; offset <= MAX_COMBINE_SLOTS; offset++) {
                const nextKey = `${day}-${parseFloat(hour) + offset * 0.25}`;
                if (eventsBySlot[nextKey] && JSON.stringify(eventsBySlot[nextKey]) === JSON.stringify(events)) {
                    mergedHeight++;
                    delete eventsBySlot[nextKey]; // Mark the merged slot as processed
                } else {
                    break;
                }
            }

            slot.style.height = `${25 * mergedHeight}px`; // Adjust height for merged slots

            // Add event boxes
            const totalEvents = mergedEvents.length;
            mergedEvents.forEach((event, index) => {
                const box = document.createElement("div");
                box.className = "event-box";
                box.style.backgroundColor = event.color;
                box.style.width = `${100 / totalEvents}%`;
                box.style.left = `${(100 / totalEvents) * index}%`;
                box.textContent = event.text;
                slot.appendChild(box);
            });
        }
    });
}

function createToggles() {
    friends.forEach(friend => {
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.id = `toggle-${friend.name}`;
        toggle.checked = true;

        const label = document.createElement("label");
        label.textContent = friend.name;
        label.htmlFor = `toggle-${friend.name}`;

        const container = document.createElement("div");
        container.appendChild(toggle);
        container.appendChild(label);
        friendToggles.appendChild(container);

        toggle.addEventListener("change", updateSchedule);
    });
}

createToggles();
renderSchedule();
updateSchedule();
