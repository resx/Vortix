#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::thread;
use std::time::Duration;

#[derive(Debug)]
struct AgentArgs {
    transport: String,
    endpoint: String,
}

fn parse_args() -> AgentArgs {
    let mut transport = String::from("named-pipe");
    let mut endpoint = String::new();

    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--transport" => {
                if let Some(value) = args.next() {
                    transport = value;
                }
            }
            "--endpoint" => {
                if let Some(value) = args.next() {
                    endpoint = value;
                }
            }
            _ => {}
        }
    }

    AgentArgs {
        transport,
        endpoint,
    }
}

fn main() {
    let args = parse_args();
    let _transport = args.transport;
    let _endpoint = args.endpoint;

    loop {
        thread::sleep(Duration::from_secs(60));
    }
}
