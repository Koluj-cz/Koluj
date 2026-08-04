export type UserTrustLevel = "none" | "trusted" | "top";

export type UserTrustInput = {
  emailVerified: boolean;
  phoneProvided: boolean;
  completedBookings: number;
  ratingAverage: number;
  ratingCount: number;
  joinedAt: string;
  banned: boolean;
};

export type UserTrustProgress = {
  trusted: {
    missingPhone: boolean;
    missingCompletedBookings: number;
    missingRatings: number;
    missingRatingAverage: number;
  };
  top: {
    missingPhone: boolean;
    missingCompletedBookings: number;
    missingRatings: number;
    missingRatingAverage: number;
    blockedByBan: boolean;
  };
};

export type UserTrustSummary = UserTrustInput & {
  level: UserTrustLevel;
  label: string | null;
  progress: UserTrustProgress;
};

const TRUSTED_COMPLETED_BOOKINGS = 5;
const TRUSTED_RATING_COUNT = 3;
const TRUSTED_RATING_AVERAGE = 4.5;
const TOP_COMPLETED_BOOKINGS = 25;
const TOP_RATING_COUNT = 10;
const TOP_RATING_AVERAGE = 4.8;

function missingCount(current: number, required: number) {
  return Math.max(0, required - current);
}

function missingAverage(current: number, required: number) {
  return Math.max(0, Number((required - current).toFixed(1)));
}

export function calculateUserTrust(input: UserTrustInput): UserTrustSummary {
  const trusted =
    input.emailVerified &&
    input.phoneProvided &&
    input.completedBookings >= TRUSTED_COMPLETED_BOOKINGS &&
    input.ratingCount >= TRUSTED_RATING_COUNT &&
    input.ratingAverage >= TRUSTED_RATING_AVERAGE;

  const top =
    trusted &&
    !input.banned &&
    input.completedBookings >= TOP_COMPLETED_BOOKINGS &&
    input.ratingCount >= TOP_RATING_COUNT &&
    input.ratingAverage >= TOP_RATING_AVERAGE;

  const level: UserTrustLevel = top ? "top" : trusted ? "trusted" : "none";

  return {
    ...input,
    level,
    label:
      level === "top"
        ? "Top poskytovatel"
        : level === "trusted"
          ? "Důvěryhodný poskytovatel"
          : null,
    progress: {
      trusted: {
        missingPhone: !input.phoneProvided,
        missingCompletedBookings: missingCount(
          input.completedBookings,
          TRUSTED_COMPLETED_BOOKINGS,
        ),
        missingRatings: missingCount(input.ratingCount, TRUSTED_RATING_COUNT),
        missingRatingAverage: missingAverage(
          input.ratingAverage,
          TRUSTED_RATING_AVERAGE,
        ),
      },
      top: {
        missingPhone: !input.phoneProvided,
        missingCompletedBookings: missingCount(
          input.completedBookings,
          TOP_COMPLETED_BOOKINGS,
        ),
        missingRatings: missingCount(input.ratingCount, TOP_RATING_COUNT),
        missingRatingAverage: missingAverage(input.ratingAverage, TOP_RATING_AVERAGE),
        blockedByBan: input.banned,
      },
    },
  };
}
