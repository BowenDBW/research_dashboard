// Service module - Business logic layer
// Handles data transformation and business operations
// snake_case (database) → camelCase (frontend)

pub mod papers;
pub mod favorites;
pub mod subscriptions;
pub mod history;
pub mod stats;
pub mod chat;
pub mod daily;
pub mod venues;
pub mod manual_add;

// Re-export all services
pub use papers::*;
pub use favorites::*;
pub use subscriptions::*;
pub use history::*;
pub use stats::*;
pub use chat::*;
pub use daily::*;
pub use venues::*;
pub use manual_add::*;