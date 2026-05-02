// LLM module for Research Dashboard
// Handles cloud and local LLM interactions

pub mod types;
pub mod cloud;

use types::*;

// Re-export main types
pub use types::{ChatMessage, MessageRole, ConnectionTestResult, ProviderConfig};
pub use cloud::{CloudLlmProvider, test_local_connection};