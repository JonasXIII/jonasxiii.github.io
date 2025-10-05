const events = [
    { id: 'A', start: 1, end: 2 },
    { id: 'B', start: 1, end: 3 },
    { id: 'C', start: 2, end: 4 },
    { id: 'D', start: 3, end: 4 }
];

function renderSchedule(events) {
    const schedule = document.getElementById('schedule');
    schedule.innerHTML = ''; // Clear previous content

    // Create a timeline from 1 PM to 4 PM
    const timeline = Array(3).fill(null).map((_, i) => i + 1);

    // Create a grid to represent the schedule
    const grid = timeline.map(time => {
        return {
            time: time,
            events: events.filter(event => event.start <= time && event.end > time)
        };
    });

    // Render the grid
    grid.forEach(slot => {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'time-slot';
        timeSlot.innerHTML = `<strong>${slot.time}:00 PM</strong>`;

        slot.events.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = 'event';
            eventElement.textContent = `Event ${event.id}`;
            eventElement.style.width = `${100 / slot.events.length}%`;
            timeSlot.appendChild(eventElement);
        });

        schedule.appendChild(timeSlot);
    });
}

renderSchedule(events);