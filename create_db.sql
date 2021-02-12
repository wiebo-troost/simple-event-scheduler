CREATE DATABASE agenda_test;
CREATE USER 'agenda'@'%' IDENTIFIED WITH mysql_native_password BY 'agenda';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, DROP, ALTER, CREATE TEMPORARY TABLES, LOCK TABLES ON agenda_test.* TO 'agenda'@'%';

use agenda_test;

 CREATE TABLE `job` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NULL,
  `active` int NULL,
  `crontab` varchar(255) NULL,
  `nextRunAt` datetime NULL,
  `intervalSeconds` int NULL,
  `lastRunAt` datetime NULL,
  `startDate` datetime NULL,
  `endDate` datetime NULL,
  PRIMARY KEY (id)
  );
