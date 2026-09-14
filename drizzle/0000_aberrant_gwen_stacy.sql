CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`public_token` text NOT NULL,
	`client_id` text NOT NULL,
	`client_name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`service_id` text NOT NULL,
	`barber_id` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`price` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL
);

CREATE UNIQUE INDEX `idx_appointments_public_token` ON `appointments` (`public_token`);
CREATE INDEX `idx_appointments_barber_date` ON `appointments` (`barber_id`,`date`);
CREATE INDEX `idx_appointments_time_range` ON `appointments` (`barber_id`,`start_at`,`end_at`);
CREATE TABLE `blocked_time` (
	`id` text PRIMARY KEY NOT NULL,
	`barber_id` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE INDEX `idx_blocked_barber_time` ON `blocked_time` (`barber_id`,`start_at`,`end_at`);
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`preferred_barber` text,
	`notes` text,
	`visit_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);

CREATE UNIQUE INDEX `idx_clients_phone` ON `clients` (`phone`);
CREATE TABLE `notification_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`channel` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE INDEX `idx_notifications_appointment` ON `notification_logs` (`appointment_id`);
CREATE TABLE `waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`service_id` text NOT NULL,
	`barber_id` text,
	`preferred_date` text NOT NULL,
	`preferred_time` text,
	`status` text DEFAULT 'waiting' NOT NULL,
	`created_at` integer NOT NULL
);
