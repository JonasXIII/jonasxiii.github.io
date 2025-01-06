const MAX_COMBINE_SLOTS = 8; // Maximum number of adjacent slots to combine

const schedule = document.getElementById("schedule");
const friendToggles = document.getElementById("friend-toggles");

const friends = [
    { name: "Alice", color: "red", schedule: [{ day: 0, start: 8, end: 10, text: "Meeting" }] },
    { name: "Jonas", color: "green", schedule: [
        { day: 0, start: 13, end: 14, text: "Cloud Computing" },
        { day: 0, start: 17, end: 17.5, text: "Arch" },
        { day: 1, start: 13, end: 18, text: "Cloud Computing" },
        { day: 2, start: 13, end: 14, text: "Cloud Computing" },
        { day: 3, start: 14, end: 18, text: "Deep Learning" },
        { day: 4, start: 13, end: 14, text: "Cloud Computing" },
    ] },
    { name: "Charlie", color: "blue", schedule: [{ day: 0, start: 9, end: 12, text: "Call" }] },
];

function renderSchedule() {
    schedule.innerHTML = "";

    // Add days as headers
    const daysRow = document.createElement("div");
    daysRow.className = "schedule-header";
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    dayNames.forEach(day => {
        const dayHeader = document.createElement("div");
        dayHeader.className = "schedule-header";
        dayHeader.textContent = day;
        schedule.appendChild(dayHeader);
    });

    // Add time column
    const timeColumn = document.createElement("div");
    timeColumn.className = "time-column";
    for (let i = 8; i <= 21.75; i += 0.25) {
        const timeSlot = document.createElement("div");
        timeSlot.className = "time-slot";
        const hour = Math.floor(i);
        const minutes = (i % 1) * 60;
        timeSlot.textContent = `${hour}:${minutes === 0 ? "00" : minutes}`;
        timeColumn.appendChild(timeSlot);
    }
    schedule.appendChild(timeColumn);

    // Add schedule columns for days
    for (let i = 0; i < 5; i++) {
        const dayColumn = document.createElement("div");
        dayColumn.className = "schedule-day";
        for (let j = 8; j <= 21.75; j += 0.25) {
            const slot = document.createElement("div");
            slot.className = "schedule-slot";
            slot.dataset.day = i;
            slot.dataset.hour = j;
            dayColumn.appendChild(slot);
        }
        schedule.appendChild(dayColumn);
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
