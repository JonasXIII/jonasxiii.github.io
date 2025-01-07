const MAX_COMBINE_SLOTS = 8;

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
        { day: 3, start: 14, end: 16, text: "Deep Learning"},
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
        { day: 3, start: 14, end: 16, text: "Deep Learning"},
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
        { day: 3, start: 14, end: 16, text: "Deep Learning"},
        { day: 3, start: 16.5, end: 17.5, text: "Reading Group"},
        { day: 4, start: 11, end: 12, text: "Databases"},
        { day: 4, start: 12, end: 13, text: "OOD"},
    ] },
];

function fillSchedule() {
    const alltimeSlots = [[],[],[],[],[]];
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 56; j++) {
            alltimeSlots[i].push([]);
        }
    }
    for (const friend of friends) {
        if (!document.getElementById(`toggle-${friend.name}`).checked) continue;
        for (const event of friend.schedule) {
            for (let i = event.start; i < event.end; i += 0.25) {
                const val = Math.round(i*4) - 32;
                if (val >= 0 && val < 56) {
                    alltimeSlots[event.day][val].push({text: event.text, color: friend.color});
                }
            }
        }
    }
    return alltimeSlots;
}

function arrayEquals(a1, a2) {
    return JSON.stringify([...a1].sort((a, b) => a.text.localeCompare(b.text))) === 
           JSON.stringify([...a2].sort((a, b) => a.text.localeCompare(b.text)));
}

function identicalTimeSlots(allTimeSlots, time1, time2) {
    if (time1 < 0 || time2 < 0 || time1 >= 56 || time2 >= 56) return false;
    
    for (let day = 0; day < 5; day++) {
        if (!arrayEquals(allTimeSlots[day][time1], allTimeSlots[day][time2])) {
            return false;
        }
    }
    return true;
}

function getFinalTimeSlots(filledSchedule) {
    const goodTimeSlots = [];
    let currentSlot = 0;
    
    while (currentSlot < 56) {
        goodTimeSlots.push(currentSlot);
        
        // Find how many subsequent slots are identical
        let nextSlot = currentSlot + 1;
        while (nextSlot < 56 && identicalTimeSlots(filledSchedule, currentSlot, nextSlot)) {
            nextSlot++;
        }
        
        // Jump to the next different slot
        currentSlot = nextSlot;
    }
    
    return goodTimeSlots;
}

function getMergedHeight(filledSchedule, startSlot, finalTimeSlots, startIndex) {
    let height = 1;
    for (let i = startIndex + 1; i < finalTimeSlots.length; i++) {
        if (identicalTimeSlots(filledSchedule, startSlot, finalTimeSlots[i])) {
            height++;
        } else {
            break;
        }
    }
    return height;
}

function renderSchedule() {
    schedule.innerHTML = "";
    
    // Add day headers
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const timeHeader = document.createElement("div");
    timeHeader.className = "schedule-header";
    timeHeader.style.gridColumn = "1";
    schedule.appendChild(timeHeader);
    
    dayNames.forEach((day, index) => {
        const dayHeader = document.createElement("div");
        dayHeader.className = "schedule-header";
        dayHeader.style.gridColumn = `${index + 2}`;
        dayHeader.textContent = day;
        schedule.appendChild(dayHeader);
    });

    const filledSchedule = fillSchedule();
    const finalTimeSlots = getFinalTimeSlots(filledSchedule);
    
    // Track which grid rows we've already handled due to merging
    const handledRows = new Set();

    finalTimeSlots.forEach((slotIndex, index) => {
        if (handledRows.has(index)) return;

        const mergedHeight = getMergedHeight(filledSchedule, slotIndex, finalTimeSlots, index);
        for (let i = 0; i < mergedHeight; i++) {
            handledRows.add(index + i);
        }

        const hour = Math.floor(slotIndex / 4) + 8;
        const minutes = (slotIndex % 4) * 15;
        const timeString = `${hour}:${minutes.toString().padStart(2, "0")}`;
        
        // Add time label
        const timeSlot = document.createElement("div");
        timeSlot.className = "time-slot";
        timeSlot.textContent = timeString;
        timeSlot.style.gridRow = `${index + 2}`;
        timeSlot.style.gridColumn = "1";
        schedule.appendChild(timeSlot);

        // Add schedule slots for each day
        for (let day = 0; day < 5; day++) {
            const slot = document.createElement("div");
            slot.className = "schedule-slot";
            slot.style.gridColumn = `${day + 2}`;
            slot.style.gridRow = `${index + 2}`;

            const events = filledSchedule[day][slotIndex];
            if (events.length > 0) {
                slot.style.height = `${25 * mergedHeight}px`;
                
                // Sort events by text for consistent ordering
                const sortedEvents = [...events].sort((a, b) => a.text.localeCompare(b.text));
                
                sortedEvents.forEach((event, eventIndex) => {
                    const box = document.createElement("div");
                    box.className = "event-box";
                    box.style.backgroundColor = event.color;
                    box.style.width = `${100 / events.length}%`;
                    box.style.left = `${(100 / events.length) * eventIndex}%`;
                    box.textContent = event.text;
                    slot.appendChild(box);
                });
            } else {
                slot.style.height = "25px";
            }

            schedule.appendChild(slot);
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

        toggle.addEventListener("change", renderSchedule);
    });
}

createToggles();
renderSchedule();