// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with AdapterRegistry
abstract contract AdapterRegistryHandler is Properties {

    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function adapterRegistry_markDeprecated_clamped(address adapter, string memory reason) public {
        // TODO: clamp adapter — e.g. adapter = toActor(adapter);
        adapterRegistry_markDeprecated(adapter, reason);
    }

    function adapterRegistry_markVerified_clamped(address adapter, string memory auditReference) public {
        // TODO: clamp adapter — e.g. adapter = toActor(adapter);
        adapterRegistry_markVerified(adapter, auditReference);
    }

    function adapterRegistry_registerAdapter_clamped(address adapter, uint8 adapterType) public {
        // TODO: clamp adapter — e.g. adapter = toActor(adapter);
        adapterRegistry_registerAdapter(adapter, adapterType);
    }

    function adapterRegistry_setAuditGovernance_clamped(address newGovernance) public {
        // TODO: clamp newGovernance — e.g. newGovernance = toActor(newGovernance);
        adapterRegistry_setAuditGovernance(newGovernance);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function adapterRegistry_markDeprecated(address adapter, string memory reason) public asActor {
        // TODO: wire call — adapterRegistry.markDeprecated(adapter, reason);
    }

    function adapterRegistry_markVerified(address adapter, string memory auditReference) public asActor {
        // TODO: wire call — adapterRegistry.markVerified(adapter, auditReference);
    }

    function adapterRegistry_registerAdapter(address adapter, uint8 adapterType) public asActor {
        // TODO: wire call — adapterRegistry.registerAdapter(adapter, adapterType);
    }

    function adapterRegistry_setAuditGovernance(address newGovernance) public asActor {
        // TODO: wire call — adapterRegistry.setAuditGovernance(newGovernance);
    }
}
