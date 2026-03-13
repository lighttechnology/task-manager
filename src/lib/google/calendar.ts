import { google } from "googleapis";
import { addHours, addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { Task } from "@/types";

function getCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

function priorityToColorId(priority: string): string {
  switch (priority) {
    case "high":
      return "11"; // 赤
    case "medium":
      return "5"; // 黄
    default:
      return "1"; // 青
  }
}

/**
 * JST基準で時刻が 00:00:00 なら終日とみなす
 */
function isAllDayDate(dateStr: string): boolean {
  const jst = toZonedTime(new Date(dateStr), "Asia/Tokyo");
  return jst.getHours() === 0 && jst.getMinutes() === 0 && jst.getSeconds() === 0;
}

export async function syncTaskToCalendar(
  task: Task,
  accessToken: string
): Promise<string | null> {
  if (!task.due_date) return null;

  const calendar = getCalendarClient(accessToken);
  const allDay = isAllDayDate(task.due_date);

  // Google Calendar API:
  //   終日イベント → date を使用。end は翌日（排他的終了日）
  //   時刻指定    → dateTime を使用
  const jst = toZonedTime(new Date(task.due_date), "Asia/Tokyo");
  const startDate = format(jst, "yyyy-MM-dd");
  const endDate = format(addDays(jst, 1), "yyyy-MM-dd");

  const event = allDay
    ? {
        summary: task.title,
        description: task.description ?? "",
        start: { date: startDate },
        end: { date: endDate },
        colorId: priorityToColorId(task.priority),
      }
    : {
        summary: task.title,
        description: task.description ?? "",
        start: { dateTime: task.due_date, timeZone: "Asia/Tokyo" },
        end: {
          dateTime: addHours(new Date(task.due_date), 1).toISOString(),
          timeZone: "Asia/Tokyo",
        },
        colorId: priorityToColorId(task.priority),
      };

  if (task.google_calendar_event_id) {
    const res = await calendar.events.update({
      calendarId: "primary",
      eventId: task.google_calendar_event_id,
      requestBody: event,
    });
    return res.data.id ?? null;
  } else {
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });
    return res.data.id ?? null;
  }
}

export async function deleteCalendarEvent(
  eventId: string,
  accessToken: string
): Promise<void> {
  const calendar = getCalendarClient(accessToken);
  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });
}
