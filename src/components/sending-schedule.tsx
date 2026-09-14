"use client";
export function SendingSchedule({
  value,
  onChange,
}: {
  value: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
}) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div>
      <label className="check">
        <input
          type="checkbox"
          checked={!!value.scheduleSending}
          onChange={(e) =>
            onChange({
              scheduleSending: e.target.checked,
              ...(e.target.checked
                ? Object.fromEntries(
                    days.flatMap((day, i) => [
                      [`send${day}`, value[`send${day}`] ?? i < 5],
                      [`send${day}After`, value[`send${day}After`] ?? 540],
                      [`send${day}Before`, value[`send${day}Before`] ?? 1020],
                    ]),
                  )
                : {}),
            })
          }
        />
        Use a sending schedule
      </label>
      {value.scheduleSending &&
        days.map((day) => (
          <div key={day} className="schedule-row">
            <label className="check">
              <input
                type="checkbox"
                checked={!!value[`send${day}`]}
                onChange={(e) => onChange({ [`send${day}`]: e.target.checked })}
              />
              {day}
            </label>
            {["After", "Before"].map((part, i) => {
              const key = `send${day}${part}`,
                minutes = Number(value[key] ?? (i ? 1020 : 540));
              return (
                <label key={key}>
                  {i ? "End" : "Start"}
                  <input
                    type="time"
                    required
                    value={`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      onChange({ [key]: h * 60 + m });
                    }}
                  />
                </label>
              );
            })}
          </div>
        ))}
    </div>
  );
}
